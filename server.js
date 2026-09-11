// UrjaSetu — Renewable Energy Manager (plan-strict build)
// Single website: Solar + Wind + Hydro | Forecast→Production→Storage→Distribution
// Roles: admin + weather/production/storage/transmission uploaders, each with large/small scale.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');

const AI = require('./ai-engine');
const Gemini = require('./gemini');
const { fetchWeather, fetchCity } = require('./weather');
const { load, save, VALID_ROLES, VALID_SCALES } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = 'renew-secret-demo-2026';

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

(function ensureAdmin() {
  const db = load();
  let admin = db.users.find(u => u.email === 'admin@renew.io');
  const fresh = bcrypt.hashSync('admin123', 10);
  if (!admin) db.users.push({ id: 'u-admin', name: 'Admin', email: 'admin@renew.io', pass: fresh, role: 'admin', scale: 'small', org: 'Adamas University (demo)' });
  else { admin.pass = fresh; admin.role = 'admin'; }
  save(db);
})();

function sign(u) { return jwt.sign({ id: u.id, role: u.role, email: u.email, name: u.name, scale: u.scale }, JWT_SECRET, { expiresIn: '12h' }); }
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!tok) return res.status(401).json({ error: 'Login required' });
  try { req.user = jwt.verify(tok, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Session expired' }); }
}
const needAdmin = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only admin' });

// ---------------- AUTH (scale first, then role) ----------------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, scale, org } = req.body || {};
  if (!name || !email || !password || !role || !scale) return res.status(400).json({ error: 'name, email, password, role, scale required' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!VALID_SCALES.includes(scale)) return res.status(400).json({ error: 'Scale must be large or small' });
  const db = load();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(400).json({ error: 'Email already registered' });
  const u = { id: 'u-' + Date.now(), name, email, pass: bcrypt.hashSync(password, 10), role, scale, org: org || '' };
  db.users.push(u); save(db);
  res.json({ token: sign(u), user: { id: u.id, name, email, role, scale, org: u.org } });
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = load();
  const u = db.users.find(x => x.email.toLowerCase() === String(email || '').toLowerCase());
  if (!u) return res.status(400).json({ error: 'No account for this email. Create account first (pick scale + role).' });
  if (!bcrypt.compareSync(password || '', u.pass)) return res.status(400).json({ error: 'Wrong password' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, scale: u.scale || 'small', org: u.org || '' } });
});
app.get('/api/meta', (req, res) => res.json({ roles: VALID_ROLES, scales: VALID_SCALES, models: AI.models.metrics, tolerancePct: AI.TOLERANCE_PCT }));
app.get('/api/stats', (req, res) => {
  const db = load();
  // homepage = absolute lifetime totals of everything done to this date
  let prod = 0, dist = 0;
  for (const r of (db.daily.production || [])) {
    const d = r.data || {};
    prod += +(r.totalProduced || d.producedKW || ((+d.windKW || 0) + (+d.solarKW || 0) + (+d.hydroKW || 0))) || 0;
  }
  for (const r of (db.daily.transmission || [])) {
    const d = r.data || {};
    dist += +(d.totalDistributedKW ?? d.totalKW ?? 0) || 0;
  }
  res.json({ customers: db.users.length, totalProduction: +prod.toFixed(1), totalDistribution: +dist.toFixed(1) });
});

// ---------------- helpers ----------------
async function sourceBundle(source, cityKey) {
  const db = load();
  const weatherAll = await fetchWeather(cityKey || 'kolkata');
  const weather = weatherAll.city[cityKey] || weatherAll;
  const ops = AI.analyzeWeatherToOps(source, weather);
  const equipIssues = AI.predictMaintenance(db.equipment[source]);
  const equipSuggest = AI.recommendEquipment(source);
  const batt = AI.analyzeBattery(db.batteries[source]);
  const txLossPct = +(Math.abs(db.readings[source].calc.transmitted - db.readings[source].actual.transmitted) / db.readings[source].calc.transmitted * 100 + 2.5).toFixed(2);
  const distAlerts = AI.analyzeDistribution(db.stations[source], txLossPct);
  const roadmap = AI.roadmapCheck(db.readings[source].calc, db.readings[source].actual);
  const histAvg = +(db.history.reduce((a, h) => a + h[source], 0) / db.history.length).toFixed(2);
  return { db, weatherAll, weather, ops, equipIssues, equipSuggest, batt, txLossPct, distAlerts, roadmap, histAvg };
}
function pastCountFor(db, source, stage) {
  return db.decisions.filter(d => d.source === source && (d.stage === stage || (!d.stage && stage === 'production'))).length
    + db.manualDecisions.filter(d => (d.source || '') === source).length;
}
// point 6: hide problems the admin already decided on, so health recovers
function isResolved(db, key) { return (db.resolvedLive || []).some(r => r.key === key); }
function applyResolutions(db, det) {
  det.probs = det.probs.filter(p => !isResolved(db, p.liveKey));
  if (!det.probs.length) det.score = 92;
  return det;
}
function resolveLive(db, liveKey, action) {
  if (!liveKey) return;
  db.resolvedLive = db.resolvedLive || [];
  if (!db.resolvedLive.some(r => r.key === liveKey)) db.resolvedLive.push({ key: liveKey, action: action || 'decided', at: new Date().toISOString() });
}

// ---------------- DASHBOARD (admin first screen) ----------------
app.get('/api/dashboard', auth, async (req, res) => {
  const cityKey = req.query.city || 'kolkata';
  const db = load();
  const weatherAll = await fetchWeather(cityKey);
  const totals = {}, usages = {};
  for (const s of ['wind', 'solar', 'hydro']) {
    totals[s] = db.readings[s].actual.produced;
    usages[s] = +(db.readings[s].actual.houses + db.readings[s].actual.industry + db.readings[s].actual.others).toFixed(2);
  }
  const totalProd = +(totals.wind + totals.solar + totals.hydro).toFixed(2);
  const totalUse = +(usages.wind + usages.solar + usages.hydro).toFixed(2);
  const split = {};
  for (const s of ['wind', 'solar', 'hydro']) split[s] = { homes: db.readings[s].actual.houses, lights: db.readings[s].actual.industry, others: db.readings[s].actual.others };
  // most-recent production uploads per source (for dashboard pies)
  const prodSeries = { wind: [], solar: [], hydro: [] };
  for (const r of (db.daily.production || []).slice(-7)) {
    const d = r.data || {}, day = (r.at || '').slice(5, 10);
    if (+d.windKW > 0) prodSeries.wind.push({ day, kw: +d.windKW });
    if (+d.solarKW > 0) prodSeries.solar.push({ day, kw: +d.solarKW });
    if (+d.hydroKW > 0) prodSeries.hydro.push({ day, kw: +d.hydroKW });
  }
  let auto = [];
  const perSource = {};
  for (const s of ['wind', 'solar', 'hydro']) {
    const st = await sourceBundle(s, cityKey);
    const stages = ['forecast', 'production', 'storage', 'distribution'];
    const stageProbs = {};
    for (const stage of stages) {
      const r = AI.detectStageProblems({
        source: s, stage, weather: st.weather,
        equipment: { current: db.equipment[s] }, battery: { ...db.batteries[s], analysis: st.batt },
        distAlerts: { txLossPct: st.txLossPct }, roadmap: st.roadmap, pastCount: pastCountFor(db, s, stage)
      });
      applyResolutions(db, r);
      stageProbs[stage] = r;
    }
    perSource[s] = stageProbs;
    for (const stage of stages) auto = auto.concat(AI.generateDecisions({ problems: stageProbs[stage].probs }));
  }
  const pendingStored = db.decisions.filter(d => d.status === 'pending');
  const alerts = auto.filter(d => d.priority === 'critical').slice(0, 4);
  res.json({
    totals: { ...totals, total: totalProd }, usages: { ...usages, total: totalUse }, split, prodSeries,
    pendingCount: pendingStored.length + auto.length,
    pendingStored: pendingStored.length, pendingAuto: auto.length,
    alerts, weather: weatherAll, perSource,
    scale: req.user.scale, history: db.history.slice(-14)
  });
});

// ---------------- ENERGY TRACKING ----------------
// ?source=wind|solar|hydro & city=kolkata : 4 stages Forecast→Production→Storage→Distribution
app.get('/api/tracking', auth, async (req, res) => {
  const source = ['wind', 'solar', 'hydro'].includes(req.query.source) ? req.query.source : 'wind';
  const cityKey = req.query.city || 'kolkata';
  const st = await sourceBundle(source, cityKey);
  const { db } = st;
  const txLoss = st.txLossPct;
  const r = db.readings[source];
  const totProd = r.actual.produced, totStor = r.actual.stored, totTx = r.actual.transmitted;
  const usageSum = +(r.actual.houses + r.actual.industry + r.actual.others).toFixed(2);
  const pct = (a, b) => b ? +((a / b) * 100).toFixed(1) : 0;

  const mkStage = (stage, stats, extra) => {
    const det = applyResolutions(db, AI.detectStageProblems({
      source, stage, weather: st.weather, equipment: { current: db.equipment[source] },
      battery: { ...db.batteries[source], analysis: st.batt },
      distAlerts: { txLossPct: txLoss }, roadmap: st.roadmap, pastCount: pastCountFor(db, source, stage)
    }));
    // predicted problems (next 3-7 days heuristic from forecast + trends) — clickable, with early fix
    const predicted = [];
    const fc = st.weather.forecast || [];
    const badDays = fc.filter(f => (f.rainSum ?? 0) > 5 || (f.windMax ?? 0) > 60).slice(0, 2);
    const srcWord = { solar: 'solar panels', wind: 'windmills', hydro: 'hydro turbines' }[source];
    for (const b of badDays) predicted.push({
      text: `${b.date}: bad weather may stress the ${stage} step.`,
      confidence: 68,
      detail: `On ${b.date} the forecast shows rain ${b.rainSum}mm and wind ${b.windMax} km/h at your site. In past weeks, similar days made the ${srcWord} produce less and pushed extra pressure on the ${stage} step. This has NOT happened yet — it is an early warning.`,
      earlySolution: stage === 'forecast' ? 'A day before, plan which source runs most (wind vs solar vs hydro) and keep workers ready.' : stage === 'production' ? 'A day before, service the machines lightly and keep a backup unit ready so a breakdown hurts less.' : stage === 'storage' ? 'Charge the batteries fuller today and protect the 15% emergency savings, so the bad day can run on stored power.' : 'A day before, inform users of possible short supply and keep the patrol team ready for wire checks.'
    });
    if (db.equipment[source].efficiencyPct < 86 && stage === 'production') predicted.push({ text: 'A machine breakdown is likely within 7 days.', confidence: 74, detail: `The ${srcWord} are slowly making less power each day (now ${db.equipment[source].efficiencyPct}%, healthy is above 86%). If nothing is done, a full breakdown is likely within a week.`, earlySolution: 'Book a 2–4 hour servicing slot NOW for oiling, cleaning and alignment — a small fix today avoids a big repair later.' });
    if (st.batt.emergencyPct < 15 && stage === 'storage') predicted.push({ text: 'Emergency savings may run out within 3 days.', confidence: 71, detail: `Only ${st.batt.emergencyPct}% is saved for emergencies (rule needs 15%) and daily use keeps eating into it. At this speed the emergency savings will be empty in about 3 days.`, earlySolution: 'From today, send a little less power to normal use and move the extra into emergency savings until it reaches 15%.' });
    if (txLoss > 5 && stage === 'distribution') predicted.push({ text: 'Wire loss may cross the danger limit within a week.', confidence: 69, detail: `Wire loss is ${txLoss}% today (danger limit is 8%) and rising slowly. If nothing changes it will cross 8% within a week, wasting power daily.`, earlySolution: 'This week: switch the main lines to high-voltage (132–220 kV) and get the joints checked once.' });
    return {
      key: stage, hasProblem: det.probs.length > 0, health: det.score,
      performance: det.score > 80 ? 'Excellent' : det.score > 60 ? 'Good' : det.score > 40 ? 'Needs attention' : 'Critical',
      stats, problems: det.probs.map((p, i) => ({ id: `${source}-${stage}-${i}`, ...p })),
      predicted, ml: det.ml, ...extra
    };
  };

  const stages = [
    mkStage('forecast', { tempC: st.weather.tempC, windKph: st.weather.windKph, cloudPct: st.weather.cloudPct, rainMm: st.weather.rainMm, riverFlow: st.weather.riverFlowCumec, irradiance: st.weather.solarIrradiance, impact: st.weather.impact, ops: st.ops }),
    mkStage('production', { producedKW: r.actual.produced, calcKW: r.calc.produced, equipment: db.equipment[source], issues: st.equipIssues, upgrades: st.equipSuggest, historyAvg: st.histAvg }),
    mkStage('storage', { storedMWh: db.batteries[source].storedMWh, capacityMWh: db.batteries[source].capacityMWh, healthPct: db.batteries[source].healthPct, emergencyMWh: db.batteries[source].emergencyReserveMWh, cycles: db.batteries[source].cycles, analysis: st.batt }),
    mkStage('distribution', { transmittedMWh: r.actual.transmitted, txLossPct: txLoss, stations: db.stations[source], alerts: st.distAlerts, roadmap: st.roadmap })
  ];
  res.json({
    source, city: cityKey, weather: st.weather,
    flow: ['forecast', 'production', 'storage', 'distribution'],
    stages,
    totals: {
      produced: totProd, stored: totStor, distributed: totTx, used: usageSum,
      storedPct: pct(totStor, totProd), distributedPct: pct(totTx, totProd), usedPct: pct(usageSum, totTx),
      breakdown: { homes: r.actual.houses, streetlights: r.actual.industry, others: r.actual.others }
    },
    roadmap: st.roadmap
  });
});

// flat problem list (Approvals consumes this + stored decisions)
app.get('/api/problems', auth, async (req, res) => {
  const cityKey = req.query.city || 'kolkata';
  const db = load();
  const out = [];
  for (const s of ['wind', 'solar', 'hydro']) {
    const st = await sourceBundle(s, cityKey);
    for (const stage of ['forecast', 'production', 'storage', 'distribution']) {
      const det = applyResolutions(db, AI.detectStageProblems({
        source: s, stage, weather: st.weather, equipment: { current: db.equipment[s] },
        battery: { ...db.batteries[s], analysis: st.batt }, distAlerts: { txLossPct: st.txLossPct },
        roadmap: st.roadmap, pastCount: pastCountFor(db, s, stage)
      }));
      det.probs.forEach((p) => out.push({ id: p.liveKey, live: true, ...p }));
    }
  }
  const stored = db.decisions.map(d => ({ id: String(d.id), live: false, ...d }));
  res.json({ live: out, stored, models: AI.models.metrics });
});

// ---------------- APPROVALS ----------------
app.get('/api/decisions', auth, (req, res) => {
  const db = load();
  res.json({ decisions: [...db.decisions].reverse(), manual: [...db.manualDecisions].reverse(), learnings: AI.learnings.slice(-20) });
});
app.post('/api/decisions/:id/:action', auth, needAdmin, (req, res) => {
  const db = load();
  const d = db.decisions.find(x => String(x.id) === String(req.params.id));
  if (!d) return res.status(404).json({ error: 'Not found' });
  const { action } = req.params;
  if (action === 'approve') { d.status = 'approved'; d.decidedBy = req.user.email; d.decidedAt = new Date().toISOString(); }
  else if (action === 'reject') {
    if (!req.body.reason) return res.status(400).json({ error: 'Rejection reason required (trains the AI)' });
    d.status = 'rejected'; d.reason = req.body.reason; d.decidedBy = req.user.email; d.decidedAt = new Date().toISOString();
    AI.learnings.push({ msg: `REJECTED "${d.title}" because: ${req.body.reason}`, at: new Date().toISOString() });
  } else return res.status(400).json({ error: 'bad action' });
  save(db); res.json({ ok: true, decision: d });
});
// promote a live AI problem into approvals, or admin makes own solution
app.post('/api/decisions/promote', auth, needAdmin, (req, res) => {
  const { source, stage, what, why, how, past, solution, aim, severity, liveKey } = req.body || {};
  if (!what) return res.status(400).json({ error: 'what required' });
  const db = load();
  const d = { id: db.seq.decision++, source: source || 'wind', stage: stage || 'production', title: `[${source}/${stage}] ${String(what).slice(0, 80)}`, what, why: why || '', how: how || '', past: past || '', detail: `${why || ''} ${how || ''}`, solution: solution || '', aim: aim || '', priority: severity === 'critical' ? 'critical' : 'medium', fix: solution || '', mlPerceived: how || '', status: 'pending', createdAt: new Date().toISOString() };
  db.decisions.push(d);
  resolveLive(db, liveKey, 'promoted');   // live problem disappears from tracking, health recovers
  save(db); res.json(d);
});
app.post('/api/decisions/manual', auth, needAdmin, (req, res) => {
  const { title, detail, source, stage, problemClass, liveKey } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const db = load();
  const aiReply = AI.mlChatbotRespond(title + ' ' + (detail || ''));
  const m = { id: 'm-' + Date.now(), title, detail: detail || '', source: source || 'wind', stage: stage || 'production', by: req.user.email, at: new Date().toISOString(), aiReply };
  db.manualDecisions.unshift(m);
  AI.manualSolutions.push({ problemClass: problemClass ?? 1, text: title + ' ' + (detail || ''), at: m.at });
  AI.learnings.push({ msg: `ADMIN SOLUTION: ${title}`, at: m.at });
  resolveLive(db, liveKey, 'manual-solution');
  save(db); res.json(m);
});

// ---------------- AI DESK (chat + insights) ----------------
app.post('/api/chat', auth, async (req, res) => {
  const msg = req.body.message || '';
  if (Gemini.isConfigured()) {
    const g = await Gemini.generate(
      `Context: renewable-energy management (wind/solar/hydro; flow forecast→production→storage→distribution; tolerance ±7%). Learnings: ${JSON.stringify(AI.learnings.slice(-10))}. User (${req.user.role}, ${req.user.scale} scale) says: ${msg}`,
      { system: 'You are UrjaSetu, expert renewable-energy ops co-pilot. 3-6 crisp lines with numbers + next actions. End with what you learned.' }
    );
    if (g.ok) { AI.learnings.push({ msg: `GEMINI chat: ${msg}`, at: new Date().toISOString() }); return res.json({ reply: g.text, engine: 'gemini:' + Gemini.MODEL }); }
  }
  res.json({ reply: AI.mlChatbotRespond(msg, req.body.context || {}), engine: `ml-chatbot(${AI.models.metrics ? AI.models.metrics.chat_pairs : 68} pairs)` });
});
app.get('/api/insights', auth, async (req, res) => {
  const base = AI.cuttingEdgeInsights();
  let geminiExtra = null;
  if (Gemini.isConfigured()) {
    const g = await Gemini.generate('Suggest 3 ecosystem upgrades (generation, storage, HV distribution) + one 30-45 day weather early warning for India. Format "Title — detail".', { system: 'You are UrjaSetu strategy analyst. Concrete tech, numbers, paybacks.' });
    if (g.ok) geminiExtra = g.text;
  }
  res.json({ insights: base, geminiExtra, gemini: Gemini.isConfigured() ? Gemini.MODEL : null, note: 'Ecosystem upgrades + long-range weather early warnings.' });
});
app.post('/api/decisions/:id/explain', auth, async (req, res) => {
  const db = load();
  const d = db.decisions.find(x => String(x.id) === String(req.params.id));
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (!Gemini.isConfigured()) return res.status(400).json({ error: 'Gemini key not configured — add it in AI Desk.' });
  const g = await Gemini.generate(`Explain this ops decision for a non-expert admin + risks + 4-step approval checklist. Decision: ${JSON.stringify(d)}`, { system: 'You are UrjaSetu. Plain explanation + checklist.' });
  if (!g.ok) return res.status(502).json({ error: 'Gemini failed: ' + g.reason });
  res.json({ explanation: g.text, engine: 'gemini:' + Gemini.MODEL });
});
app.get('/api/config/status', auth, (req, res) => res.json({ gemini: Gemini.isConfigured(), model: Gemini.MODEL, env: !!process.env.GEMINI_API_KEY }));
app.post('/api/config/gemini', auth, needAdmin, (req, res) => { Gemini.setKey(req.body.key || ''); res.json({ ok: true, gemini: Gemini.isConfigured(), model: Gemini.MODEL }); });

// ---------------- SIMULATION ----------------
app.get('/api/simulation/techs', auth, (req, res) => {
  const sim = AI.models.sim;
  res.json({ techs: (sim && sim.techs) || { production: [], storage: [], distribution: [] }, engine: sim ? sim.engine : 'fallback' });
});
// current real system, built from latest uploads
app.get('/api/simulation/current', auth, async (req, res) => {
  const db = load();
  const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
  const prod = last(db.daily.production), stor = last(db.daily.storage), tx = last(db.daily.transmission);
  const nodes = [], edges = [];
  const pNodes = [], sNodes = [], dNodes = [];
  (prod && prod.data && prod.data.machines || []).forEach((m, i) => {
    const id = `p${i}`;
    nodes.push({ id, kind: 'production', label: m.name || `Machine ${i + 1}`, tech: m.tech || 'unknown', capKW: m.capKW, hours: m.hours, producedKW: m.producedKW, from: `uploaded ${prod.at.slice(0, 10)}` });
    pNodes.push(id);
  });
  (stor && stor.data && stor.data.batteries || []).forEach((b, i) => {
    const id = `s${i}`;
    nodes.push({ id, kind: 'storage', label: b.name || `Battery ${i + 1}`, tech: b.tech || 'unknown', capKW: b.cap, hours: 8, storedKW: b.stored, charges: b.charges, discharges: b.discharges, from: `uploaded ${stor.at.slice(0, 10)}` });
    sNodes.push(id);
  });
  (tx && tx.data && tx.data.sectors || []).forEach((s, i) => {
    const id = `d${i}`;
    nodes.push({ id, kind: 'distribution', label: s.name || `Area ${i + 1}`, tech: 'HV-132kV line', capKW: s.kw, hours: 8, needKW: s.kw, from: `uploaded ${tx.at.slice(0, 10)}` });
    dNodes.push(id);
  });
  pNodes.forEach(p => sNodes.forEach(s => edges.push({ from: p, to: s })));
  sNodes.forEach(s => dNodes.forEach(d => edges.push({ from: s, to: d })));
  // plain-words stage summaries: calculated vs uploaded
  const sum = (ns, k) => +ns.reduce((a, id) => a + (+nodes.find(n => n.id === id)[k] || 0), 0).toFixed(1);
  const summaries = {
    production: prod ? `Uploaded total ${prod.data.producedKW ?? '—'} kW in ${prod.data.hours ?? '—'}h; machines add up to ${sum(pNodes, 'producedKW')} kW.` : 'No production machine uploads yet.',
    storage: stor ? `Received ${stor.data.receivedKW ?? '—'} kW, stored ${stor.data.storedKW ?? '—'} kW (emergency ${stor.data.emergencyKW ?? '—'} kW): holding loss ${(((stor.data.receivedKW - stor.data.storedKW) / (stor.data.receivedKW || 1)) * 100).toFixed(0)}%.` : 'No storage uploads yet.',
    distribution: tx ? `Received ${tx.data.totalReceivedKW ?? '—'} kW, shared ${tx.data.totalDistributedKW ?? '—'} kW to ${dNodes.length} areas; shortage ${tx.data.shortageKW ?? 0} kW, excess ${tx.data.excessKW ?? 0} kW.` : 'No transmission uploads yet.'
  };
  const result = AI.simScore(nodes, edges);
  res.json({ nodes, edges, summaries, score: result, suggest: AI.simSuggest(nodes), hasData: nodes.length > 0 });
});
// custom editor workflow scoring + suggestion
app.post('/api/simulation/custom', auth, (req, res) => {
  const { nodes, edges } = req.body || {};
  if (!Array.isArray(nodes)) return res.status(400).json({ error: 'nodes array required' });
  res.json({ score: AI.simScore(nodes, edges || []), suggest: AI.simSuggest(nodes) });
});
// ---------------- FORECASTS (4 cities, past+present+future + AI outlook) ----------------
app.get('/api/weather', async (req, res) => res.json(await fetchWeather(req.query.city || 'kolkata')));
app.get('/api/forecasts', auth, async (req, res) => {
  const w = await fetchWeather(req.query.city || 'kolkata');
  const outlook = [
    { horizon: '7-day', text: 'Next 7 days per-city forecast above; AI maps each day to source priority (wind vs solar vs hydro hours).' },
    { horizon: '30-day', text: 'Heatwave watch: solar +18% expected, wind -12%. Maintain wind units during lull; derate solar inverters 2%.' },
    { horizon: '45-day', text: 'Monsoon watch: above-normal inflow in 6-9 weeks likely — ready hydro turbines; defer major hydro outage.' }
  ];
  res.json({ cities: w.cities, selected: w.key, outlook, aiNote: 'Admin can test AI weather knowledge in AI Desk (ask "kolkata rain?", "wind storm protection?").' });
});

// ---------------- DAILY DATA UPLOAD (exact numbers per plan) ----------------
// AI reads free-text history / future notes (weather uploader) and pulls out figures.
// The extracted figures feed the same detection rules the ML model uses.
function extractWeatherText(histText, futureText) {
  const text = `${histText || ''} ${futureText || ''}`;
  const figures = [];
  const grab = (re, label, unit) => {
    let m; const out = [];
    const rx = new RegExp(re, 'gi');
    while ((m = rx.exec(text))) { out.push(+m[1]); }
    if (out.length) figures.push({ label, values: out.slice(0, 4), unit });
    return out;
  };
  const rains = grab('(\\d+(?:\\.\\d+)?)\\s*(?:mm|millimetres?|millimeters?)', 'rain', 'mm');
  const winds = grab('(\\d+(?:\\.\\d+)?)\\s*(?:km\\s*\\/?\\s*h|kmph|kilometres? per hour)', 'wind', 'km/h');
  const temps = grab('(\\d+(?:\\.\\d+)?)\\s*(?:°c|degrees?|deg c|temp)', 'temperature', '°C');
  const clouds = grab('(\\d+(?:\\.\\d+)?)\\s*%', 'cloud cover', '%');
  const risks = [];
  const maxRain = rains.length ? Math.max(...rains) : 0;
  const maxWind = winds.length ? Math.max(...winds) : 0;
  if (maxRain >= 20) risks.push(`heavy rain (~${maxRain}mm in your words) — release dam water through turbines early and protect solar panels`);
  else if (maxRain >= 2) risks.push(`rain (~${maxRain}mm in your words) — tilt solar panels to drain mode`);
  if (maxWind >= 90) risks.push(`storm wind (~${maxWind} km/h in your words) — shut down windmills, feather blades`);
  else if (maxWind > 0 && maxWind < 12) risks.push(`low wind (~${maxWind} km/h in your words) — windmills will make little power, lean on solar + hydro`);
  if (/storm|cyclone|flood/i.test(text) && !risks.length) risks.push('storm/flood words found — keep all equipment in protection mode');
  if (/heat ?wave|very hot|extreme heat/i.test(text)) risks.push('heat words found — solar peaks but inverters need 2% heat derating');
  const found = figures.length ? figures.map(f => `${f.label}: ${f.values.join(', ')}${f.unit}`).join(' · ') : 'no clear numbers found';
  return {
    figures, risks,
    note: figures.length
      ? `AI read your words (${found}). ${risks.length ? 'Early warnings: ' + risks.join('; ') + '.' : 'No danger signs in your words.'}`
      : 'AI read your words but found no clear numbers — try like "rain 22mm expected, wind 85 km/h".'
  };
}
// weather: historical/current/forecast everyday · production: kW + hours · storage: stored + emergency · transmission: per-destination
app.post('/api/daily/:kind', auth, (req, res) => {
  const kind = req.params.kind;
  if (!['weather', 'production', 'storage', 'transmission'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
  const roleMap = { production: 'production_uploader', storage: 'storage_uploader', transmission: 'transmission_uploader' };
  if (req.user.role !== 'admin' && req.user.role !== roleMap[kind]) return res.status(403).json({ error: `Only ${roleMap[kind]} or admin can upload ${kind}` });
  const db = load();
  const rec = { id: `${kind}-${Date.now()}`, kind, by: req.user.email, scale: req.user.scale, at: new Date().toISOString(), data: req.body || {} };
  // weather uploader: AI reads history + future prediction written in words
  if (kind === 'weather') rec.aiRead = extractWeatherText((req.body || {}).histText, (req.body || {}).futureText);
  // auto-apply numeric production/storage/transmission into readings (keeps demo live)
  // split a total across wind/solar/hydro in proportion to what each produced
  const splitTotal = (total) => {
    const prods = ['wind', 'solar', 'hydro'].map(s => +db.readings[s].actual.produced || 0);
    const sum = prods.reduce((a, b) => a + b, 0) || 1;
    const out = {};
    ['wind', 'solar', 'hydro'].forEach((s, i) => out[s] = +(total * prods[i] / sum).toFixed(2));
    out.hydro = +(out.hydro + (total - (out.wind + out.solar + out.hydro))).toFixed(2);
    return out;
  };
  try {
    const d = rec.data, src = ['wind', 'solar', 'hydro'].includes(d.source) ? d.source : null;
    if (kind === 'production') {
      // per-source numbers go straight to each source; total recorded as given (or summed)
      if (+d.windKW > 0) db.readings.wind.actual.produced = +d.windKW;
      if (+d.solarKW > 0) db.readings.solar.actual.produced = +d.solarKW;
      if (+d.hydroKW > 0) db.readings.hydro.actual.produced = +d.hydroKW;
      rec.totalProduced = +d.producedKW > 0 ? +d.producedKW : ((+d.windKW || 0) + (+d.solarKW || 0) + (+d.hydroKW || 0));
      if (d.hours != null && d.hours !== '') for (const s of ['wind', 'solar', 'hydro']) db.readings[s].actual.hours = +d.hours;
    }
    if (kind === 'storage' && d.storedKW != null) {
      const sh = src ? { [src]: +d.storedKW } : splitTotal(+d.storedKW);
      const em = (d.emergencyKW != null) ? (src ? { [src]: +d.emergencyKW } : splitTotal(+d.emergencyKW)) : {};
      const sn = (d.sentKW != null) ? (src ? { [src]: +d.sentKW } : splitTotal(+d.sentKW)) : {};
      for (const s of Object.keys(sh)) db.readings[s].actual.stored = sh[s];
      for (const s of Object.keys(em)) db.batteries[s].emergencyReserveMWh = em[s];
      for (const s of Object.keys(sn)) db.readings[s].actual.transmitted = sn[s];
    }
    if (kind === 'transmission') {
      // distributed total keeps per-source transmitted live (split by production share);
      // received / reserved / shortage / excess / sectors / notes stay on the record for monitoring
      if (d.totalDistributedKW != null && d.totalDistributedKW !== '') {
        const tot = splitTotal(+d.totalDistributedKW || 0);
        for (const s of ['wind', 'solar', 'hydro']) db.readings[s].actual.transmitted = tot[s];
      }
    }
    rec.roadmap = {};
    for (const s of ['wind', 'solar', 'hydro']) rec.roadmap[s] = AI.roadmapCheck(db.readings[s].calc, db.readings[s].actual);
  } catch {}
  db.daily[kind].push(rec); save(db);
  res.json({ ok: true, rec });
});
app.get('/api/daily/:kind', auth, (req, res) => {
  const db = load();
  res.json({ recs: [...(db.daily[req.params.kind] || [])].reverse().slice(0, 30) });
});
app.get('/api/uploader/stats', auth, (req, res) => {
  const db = load();
  const mine = [...db.uploads.filter(u => u.by === req.user.email), ...Object.values(db.daily).flat().filter(u => u.by === req.user.email)];
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = mine.some(u => (u.at || '').slice(0, 10) === today);
  res.json({ totalUploads: mine.length, doneToday, reminder: doneToday ? 'Today’s upload received. Thank you!' : 'Reminder: upload today’s data before 18:00 — a miss is flagged as inconsistency.', recent: mine.slice(-8).reverse() });
});

// ---------------- FEEDBACK & COMPLAINTS ----------------
app.get('/api/feedback', auth, (req, res) => { const db = load(); res.json({ feedbacks: [...db.feedbacks].reverse() }); });
app.post('/api/feedback', auth, (req, res) => {
  const { rating, message, target } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const db = load();
  const f = { id: db.seq.feedback++, by: req.user.email, role: req.user.role, rating: Math.max(1, Math.min(5, +rating || 5)), target: target || 'website', message, at: new Date().toISOString() };
  db.feedbacks.push(f); save(db); res.json(f);
});
app.get('/api/complaints', auth, (req, res) => { const db = load(); res.json({ complaints: [...db.complaints].reverse() }); });
app.post('/api/complaints', auth, (req, res) => {
  const { source, stage, text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const db = load();
  const c = { id: db.seq.complaint++, by: req.user.email, role: req.user.role, source: source || 'wind', stage: stage || 'distribution', text, status: 'open', at: new Date().toISOString() };
  db.complaints.push(c); save(db); res.json(c);
});

// ---------------- FILE uploads (pdf / word / excel only) ----------------
const store = multer.diskStorage({
  destination: (r, f, cb) => { fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true }); cb(null, path.join(__dirname, 'uploads')); },
  filename: (r, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'))
});
const upload = multer({ storage: store, fileFilter: (r, f, cb) => { const ok = /\.(pdf|docx?|xlsx?|csv)$/i.test(f.originalname); cb(ok ? null : new Error('Only PDF, Word or Excel files allowed'), ok); }, limits: { fileSize: 15 * 1024 * 1024 } });
app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const db = load();
    const kind = req.body.kind || 'general';
    let parsed = { sheets: [], textSnippet: '' };
    const fp = req.file.path;
    if (/\.xlsx?|\.csv$/i.test(req.file.originalname)) {
      const wb = xlsx.readFile(fp);
      for (const sn of wb.SheetNames.slice(0, 4)) {
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
        parsed.sheets.push({ name: sn, rows: rows.slice(0, 25), totalRows: rows.length });
        const r0 = rows[0] || {}; const keys = Object.keys(r0).map(k => k.toLowerCase());
        if (['produced', 'stored', 'transmitted'].every(k => keys.some(ck => ck.includes(k))) && rows.length) {
          const pick = (row, k) => { const ck = Object.keys(row).find(c => c.toLowerCase().includes(k)); return ck ? +row[ck] : undefined; };
          const last = rows[rows.length - 1];
          const src = /hydro/i.test(sn + JSON.stringify(r0)) ? 'hydro' : /solar/i.test(sn + JSON.stringify(r0)) ? 'solar' : 'wind';
          for (const k of ['produced', 'stored', 'transmitted', 'houses', 'industry', 'others']) { const v = pick(last, k); if (v != null && !isNaN(v)) db.readings[src].actual[k] = v; }
          const emer = pick(last, 'emergency'); if (emer != null && !isNaN(emer)) db.batteries[src].emergencyReserveMWh = emer;
          parsed.aiNote = `AI ingested numeric row into ${src} actuals and re-ran roadmap check.`;
        }
      }
    } else if (/\.pdf$/i.test(req.file.originalname)) {
      try { const pdf = require('pdf-parse'); const data = await pdf(fs.readFileSync(fp)); parsed.textSnippet = (data.text || '').slice(0, 1200); parsed.aiNote = 'AI read PDF text; Excel preferred for auto-ingest.'; }
      catch { parsed.aiNote = 'PDF stored; text extraction failed.'; }
    } else if (/\.docx?$/i.test(req.file.originalname)) {
      try { const mammoth = require('mammoth'); const out = await mammoth.extractRawText({ path: fp }); parsed.textSnippet = (out.value || '').slice(0, 1200); parsed.aiNote = 'AI read Word text; Excel preferred for auto-ingest.'; }
      catch { parsed.aiNote = 'Word stored; extraction failed.'; }
    }
    const rec = { id: db.seq.upload++, file: req.file.filename, orig: req.file.originalname, kind, by: req.user.email, role: req.user.role, at: new Date().toISOString(), parsed };
    rec.roadmap = {}; for (const s of ['wind', 'solar', 'hydro']) rec.roadmap[s] = AI.roadmapCheck(db.readings[s].calc, db.readings[s].actual);
    db.uploads.push(rec); save(db);
    res.json({ ok: true, upload: rec });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/uploads', auth, (req, res) => { const db = load(); res.json({ uploads: [...db.uploads].reverse() }); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`UrjaSetu running on http://localhost:${PORT} (demo admin: admin@renew.io / admin123)`));
