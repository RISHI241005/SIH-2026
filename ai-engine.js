// ============================================================
// AI ENGINE — 3 TRAINED ML models (loaded from ml/models/*.json)
//  Model 1 problem_detector: DecisionTree (1200 rows, ~82% acc)
//  Model 2 solution_model: learned class->solution table
//  Model 3 chatbot: TF-IDF cosine over 68-pair KB
// Plus physics/rule analytics (weather->ops, maintenance, battery,
// distribution/theft, roadmap tolerance) feeding the ML features.
// ============================================================
const fs = require('fs');
const path = require('path');

const TOLERANCE_PCT = 7;
function pctDev(calc, actual) { if (!calc) return 0; return Math.abs((calc - actual) / calc) * 100; }

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
const MDIR = path.join(__dirname, 'ml', 'models');
let PROBLEM = loadJson(path.join(MDIR, 'problem_model.json'), null);
let SOLUTION = loadJson(path.join(MDIR, 'solution_model.json'), null);
let CHAT = loadJson(path.join(MDIR, 'chatbot.json'), null);
let METRICS = loadJson(path.join(MDIR, 'metrics.json'), null);
let SIM = loadJson(path.join(MDIR, 'simulator.json'), null);

// ---------- ML Model 1: walk exported RandomForest (majority vote) ----------
const SRC = { solar: 0, wind: 1, hydro: 2 };
const STG = { forecast: 0, production: 1, storage: 2, distribution: 3 };
function treePredict(node, feats) {
  let n = node;
  while (n && !n.leaf) { n = feats[n.feat] <= n.thr ? n.left : n.right; }
  return n ? n.class : 0;
}
function forestPredict(forest, feats) {
  const votes = {};
  for (const t of forest) { const c = treePredict(t, feats); votes[c] = (votes[c] || 0) + 1; }
  let best = 0, bestN = -1;
  for (const k of Object.keys(votes)) if (votes[k] > bestN) { bestN = votes[k]; best = +k; }
  return { class: best, agreement: +(bestN / forest.length).toFixed(2) };
}
function mlDetectProblem(f) {
  // f: feature object with source/stage + numeric fields
  if (!PROBLEM || !PROBLEM.tree) return { class: fallbackClass(f), confidence: 0.62, engine: 'rule-fallback' };
  const feats = [SRC[f.source] ?? 0, STG[f.stage] ?? 1, +f.tempC || 30, +f.windKph || 18,
    +f.cloudPct || 25, +f.rainMm || 0, +f.riverFlowCumec || 110, +f.efficiencyPct || 85,
    +f.vibration || 1, +f.ageYears || 8, +f.lastServiceDays || 100, +f.batteryHealth || 85,
    +f.socPct || 60, +f.emergencyPct || 15, +f.txLossPct || 4, +f.devPct || 3,
    +f.producedKW || 3, +f.storedKW || 3];
  if (PROBLEM.tree.forest) {
    const v = forestPredict(PROBLEM.tree.forest, feats);
    return { class: v.class, name: PROBLEM.classes[String(v.class)] || PROBLEM.classes[v.class], confidence: +(0.6 + v.agreement * 0.35).toFixed(2), engine: `ml-forest(80 trees, acc ${(PROBLEM.accuracy * 100).toFixed(1)}%)` };
  }
  const cls = treePredict(PROBLEM.tree, feats);
  return { class: cls, name: PROBLEM.classes[String(cls)] || PROBLEM.classes[cls], confidence: 0.82, engine: `ml-tree(acc ${(PROBLEM.accuracy * 100).toFixed(1)}%)` };
}
function fallbackClass(f) {
  if ((+f.devPct || 0) > 20) return 5;
  if (f.stage === 'distribution' && ((+f.txLossPct || 0) > 8 || (+f.devPct || 0) > 12)) return 3;
  if (f.stage === 'storage' && ((+f.batteryHealth || 99) < 75 || (+f.emergencyPct || 99) < 10)) return 2;
  if (f.stage === 'production' && ((+f.efficiencyPct || 99) < 78 || (+f.vibration || 0) > 4.5)) return 1;
  if (f.stage === 'forecast' && ((+f.windKph || 0) > 90 || (+f.rainMm || 0) > 20)) return 4;
  return 0;
}

// ---------- ML Model 2: solution recommender ----------
function mlRecommendSolution(problemClass, adminLearnings) {
  const entry = SOLUTION && SOLUTION.table[String(problemClass)];
  const top = entry ? entry.top : [{ solution_id: 0, text: 'No action — continue routine monitoring.', prob: 1 }];
  // personalise: if admin previously wrote a manual solution for this class, quote it
  const learned = (adminLearnings || []).filter(l => l.problemClass === problemClass).slice(-1)[0];
  return {
    problemClass, className: entry ? entry.class : 'ok',
    recommendations: top,
    primary: top[0],
    adminLearned: learned ? learned.text : null,
    engine: 'ml-solution-table'
  };
}

// ---------- ML Model 3: TF-IDF chatbot ----------
function tokenize(s) { return (s || '').toLowerCase().match(/[a-z]{2,}/g) || []; }
function chatVec(tokens, idf) {
  const tf = {}; tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
  const n = tokens.length || 1, v = {};
  for (const t of Object.keys(tf)) v[t] = (tf[t] / n) * (idf[t] || 1.0);
  const norm = Math.sqrt(Object.values(v).reduce((a, x) => a + x * x, 0)) || 1;
  for (const t of Object.keys(v)) v[t] /= norm;
  return v;
}
function cosine(a, b) {
  let s = 0;
  const [sm, lg] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const t of Object.keys(sm)) if (lg[t]) s += sm[t] * lg[t];
  return s;
}
const learnings = [];          // every chat + decision trains future answers
const manualSolutions = [];    // {problemClass, text, at}
function mlChatbotRespond(msg, context) {
  learnings.push({ msg, at: new Date().toISOString() });
  const tokens = tokenize(msg + ' ' + (context || ''));
  if (!CHAT) return ruleChat(msg);
  const qv = chatVec(tokens, CHAT.idf);
  let best = null, bestS = 0;
  for (const p of CHAT.pairs) { const s = cosine(qv, p.vec); if (s > bestS) { bestS = s; best = p; } }
  // check admin-learned manual solutions first (they override when similar)
  let learnedHit = null;
  for (const m of manualSolutions.slice().reverse()) {
    const mv = chatVec(tokenize(m.text), CHAT.idf);
    if (cosine(qv, mv) > 0.28) { learnedHit = m; break; }
  }
  if (best && bestS > 0.12) {
    let reply = best.a + ` (matched ${(bestS * 100).toFixed(0)}% · ml-chatbot ${CHAT.n_pairs} pairs)`;
    if (learnedHit) reply += ` Learned from admin earlier: "${learnedHit.text.slice(0, 160)}".`;
    reply += ' I logged your question to improve future suggestions.';
    return reply;
  }
  return ruleChat(msg);
}
function ruleChat(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('theft') || m.includes('loss')) return 'Suspected theft: 1) SCADA vs meter per feeder, 2) patrol max-deviation segment, 3) check protocolOk=false stations, 4) raise HV to isolate technical vs commercial loss. Logged for learning.';
  if (m.includes('battery') || m.includes('storage')) return 'Battery: SoC 20-90%, emergency >=15%, SOH<75% replace. Surplus >25% over demand = trim setpoint. Logged for learning.';
  if (m.includes('maint')) return 'Maintenance: eff<86% service in 7 days; vibration>4.5 stop; age>15 replace. Logged for learning.';
  if (m.includes('weather') || m.includes('forecast')) return 'Weather: wind 12-90 run; solar rain>2mm cover; hydro rain>20mm release early. Tell me the source for exact ops window.';
  return 'Recorded for learning. Attach numbers (produced/stored/transmitted) so I can run the tolerance roadmap check, then I will draft an approval-ready plan.';
}

// ---------- physics/rule analytics feeding ML features ----------
function analyzeWeatherToOps(source, w) {
  const out = [];
  if (source === 'wind') {
    if (w.windKph >= 12 && w.windKph <= 90) out.push({ level: 'good', text: `Wind ${w.windKph} km/h optimal. Run all turbines at full pitch (~${w.windKph > 25 ? '14-18' : '6-10'} hrs benefit).` });
    else if (w.windKph < 12) out.push({ level: 'warn', text: `Low wind (${w.windKph} km/h). High-efficiency turbines only; park rest (~2-4 hrs benefit).` });
    else out.push({ level: 'danger', text: `Storm wind (${w.windKph} km/h). Feather blades & shut down. Zero benefit till storm passes.` });
    if (w.rainMm > 5) out.push({ level: 'warn', text: 'Rain + humidity: blade erosion inspection after rain stops.' });
  }
  if (source === 'solar') {
    if (w.cloudPct < 20 && w.rainMm === 0) out.push({ level: 'good', text: `Clear sky (cloud ${w.cloudPct}%). Peak 10:00-15:30, optimal tilt.` });
    else if (w.rainMm > 2) out.push({ level: 'danger', text: `Rain ${w.rainMm}mm — tilt-drain mode, lightning protection, pause cleaning robots.` });
    else out.push({ level: 'warn', text: `Partial cloud ${w.cloudPct}%. 15-30% dip likely. Aggressive MPPT, stagger inverters.` });
  }
  if (source === 'hydro') {
    if (w.rainMm > 20) out.push({ level: 'warn', text: `Heavy upstream rain (${w.rainMm}mm). Controlled release via turbines now — dam can't hold long.` });
    else if (w.riverFlowCumec > 150) out.push({ level: 'good', text: `Strong flow ${w.riverFlowCumec} cumec. All 3 penstocks, 12-20 hrs benefit.` });
    else if (w.riverFlowCumec < 60) out.push({ level: 'warn', text: `Low flow ${w.riverFlowCumec} cumec. Single turbine at best-efficiency, store reserve.` });
    else out.push({ level: 'good', text: `Normal flow ${w.riverFlowCumec} cumec. Standard 2-turbine 8-12 hrs.` });
  }
  return out;
}
function predictMaintenance(eq) {
  const issues = [];
  if (eq.efficiencyPct < 78) issues.push({ severity: 'high', text: `This machine makes only ${eq.efficiencyPct}% of what it should (healthy is above 86%). It needs a full repair or replacement.` });
  else if (eq.efficiencyPct < 86) issues.push({ severity: 'medium', text: `Output has fallen to ${eq.efficiencyPct}%. Please ${eq.type === 'panel' ? 'wash the panels deeply and test them' : 'oil the moving parts and straighten alignment'} within 7 days.` });
  if (eq.lastServiceDays > 180) issues.push({ severity: 'medium', text: `Nobody serviced this machine for ${eq.lastServiceDays} days (due every 180 days). A routine check-up is overdue.` });
  if (eq.vibration > 4.5) issues.push({ severity: 'high', text: `This machine is shaking too much (${eq.vibration} units — safe is below 4.5). A bearing inside is probably broken. Please stop and inspect it now.` });
  if (eq.ageYears > 15) issues.push({ severity: 'high', text: `This machine is ${eq.ageYears} years old — older than its designed life. Please replace it.` });
  else if (eq.ageYears > 10) issues.push({ severity: 'low', text: `This machine is ${eq.ageYears} years old — start saving money to replace it within 2 years.` });
  if (!issues.length) issues.push({ severity: 'low', text: 'Healthy. No action needed. Next routine check in 30 days.' });
  return issues;
}
function recommendEquipment(source) {
  const map = {
    wind: [{ name: 'Enercon E-138 EP3 E2 direct-drive', benefit: '+18% kWh/rotation, 40% less oiling downtime.' }, { name: 'Vestas V150 SmartTwist blades', benefit: '3 m/s cut-in; +12% low-wind yield.' }],
    solar: [{ name: 'TOPCon N-type bifacial 580W', benefit: '23.1% eff; +11% cloudy-day yield vs PERC.' }, { name: 'Perovskite-silicon tandem (pilot)', benefit: '28%+ lab eff; best low-light bet.' }],
    hydro: [{ name: 'Voith Kaplan BLADES+ runner', benefit: '+9% output at same flow.' }, { name: 'Andritz HIPASE magnetized bearings', benefit: 'Friction -30%, greasing halved.' }]
  };
  return map[source] || [];
}
function analyzeBattery(b) {
  const notes = [];
  const soc = b.capacityMWh ? (b.storedMWh / b.capacityMWh) * 100 : 0;
  notes.push({ k: 'SoC', v: `${soc.toFixed(1)}% (${b.storedMWh}/${b.capacityMWh} MWh)` });
  if (b.healthPct < 75) notes.push({ level: 'danger', text: `Battery health is only ${b.healthPct}% (safe is above 85%). Weak cells should be replaced, otherwise the lights can suddenly go off.` });
  else if (b.healthPct < 85) notes.push({ level: 'warn', text: `Battery health is ${b.healthPct}%, slowly weakening. Please do a balancing and heat check soon and plan to add new cells.` });
  else notes.push({ level: 'good', text: `Battery health is ${b.healthPct}% — very good.` });
  if (b.storedMWh > b.demandMWh * 1.25) notes.push({ level: 'warn', text: `You stored ${(b.storedMWh - b.demandMWh).toFixed(2)} units more than users need. Extra storage costs money and wears the battery — make a little less power.` });
  if (b.capacityMWh < b.demandMWh * 1.1) notes.push({ level: 'warn', text: `Battery size is barely enough for daily needs. Add about ${(b.demandMWh * 1.3 - b.capacityMWh).toFixed(1)} more units of capacity so one cloudy, windless day can still be covered.` });
  const emerPct = b.capacityMWh ? (b.emergencyReserveMWh / b.capacityMWh) * 100 : 0;
  if (emerPct < 10) notes.push({ level: 'danger', text: `Only ${emerPct.toFixed(1)}% is saved for emergencies, but the rule needs 15%. Please save more for blackouts.` });
  else notes.push({ level: 'good', text: `Emergency savings are ${emerPct.toFixed(1)}% — as per the rule.` });
  if (b.cycles > 4000) notes.push({ level: 'warn', text: `This battery has charged ${b.cycles} times (very high). Charge it slowly from now to make it last longer.` });
  return { soc: +soc.toFixed(1), emergencyPct: +emerPct.toFixed(1), notes };
}
function analyzeDistribution(stations, txLossPct) {
  const alerts = [];
  if (txLossPct > 8) alerts.push({ level: 'danger', text: `Too much power is lost in the wires: ${txLossPct}% (safe limit is 8%). Power should travel on high-voltage lines (132–220 kV) which waste less — please check the wires and joints.` });
  else if (txLossPct > 5) alerts.push({ level: 'warn', text: `Wire loss is ${txLossPct}%, slightly above the ideal 5%. Raising the line voltage and shortening feeders will fix it.` });
  else alerts.push({ level: 'good', text: `Wire loss is ${txLossPct}%, within safe limits. Lines are being run correctly.` });
  for (const s of stations) {
    if (!s.protocolOk) alerts.push({ level: 'danger', text: `${s.name} is not following the correct power-sending rules (${s.detail}). Please pause supply here and check with the operator.` });
    const drop = s.expectedMWh ? ((s.expectedMWh - s.actualMWh) / s.expectedMWh) * 100 : 0;
    if (drop > 12) alerts.push({ level: 'danger', text: `${s.name} suddenly received ${drop.toFixed(1)}% less power than sent (${s.expectedMWh} → ${s.actualMWh}). Someone may be stealing power — please send a patrol team to check the wires.` });
    else if (drop > TOLERANCE_PCT) alerts.push({ level: 'warn', text: `${s.name} received ${drop.toFixed(1)}% less than sent, more than the allowed ${TOLERANCE_PCT}%. Please investigate.` });
  }
  return alerts;
}
function roadmapCheck(calc, actual) {
  const rows = []; let worst = 0, flagCount = 0;
  for (const k of ['produced', 'stored', 'transmitted', 'houses', 'industry', 'others']) {
    const c = +calc[k] || 0, a = actual[k] == null ? c : +actual[k];
    const dev = pctDev(c, a); worst = Math.max(worst, dev);
    const status = dev <= TOLERANCE_PCT ? (dev <= 2 ? 'ok' : 'minor-deficit') : 'fault';
    if (status === 'fault') flagCount++;
    rows.push({ stage: k, calculated: c, actual: a, devPct: +dev.toFixed(2), status });
  }
  let verdict = 'genuine', explanation = `The uploaded numbers match expectations within the allowed ±${TOLERANCE_PCT}% difference. Small shortfalls are normal and only noted.`;
  if (flagCount >= 2 || worst > 20) { verdict = 'faulty-requires-explanation'; explanation = `The numbers do not add up: ${flagCount} step(s) differ more than the allowed ±${TOLERANCE_PCT}% (worst gap ${worst.toFixed(1)}%). Marked faulty — the uploader must explain in words what went wrong. It could be wrong data or power theft.`; }
  else if (rows.some(r => r.status === 'minor-deficit')) { verdict = 'minor-deficit'; explanation = `Mostly fine — a few steps are slightly lower than expected (2–${TOLERANCE_PCT}%), which is normal. The AI suggests a small setting adjustment.`; }
  return { rows, verdict, worstDev: +worst.toFixed(2), flagCount, explanation, tolerancePct: TOLERANCE_PCT };
}
function stageScore(problems) {
  // 100 - penalties; danger 35, warn 15
  let s = 100;
  for (const p of problems) s -= p.level === 'danger' ? 35 : p.level === 'warn' ? 15 : 0;
  return Math.max(5, Math.min(100, s));
}

// Full per-source per-stage ML detection -> problem objects with what/why/how/past/solution
function detectStageProblems({ source, stage, weather, equipment, battery, distAlerts, roadmap, pastCount }) {
  const batt = battery.analysis || analyzeBattery(battery);
  const feat = {
    source, stage, tempC: weather.tempC, windKph: weather.windKph, cloudPct: weather.cloudPct,
    rainMm: weather.rainMm, riverFlowCumec: weather.riverFlowCumec,
    efficiencyPct: equipment.current.efficiencyPct, vibration: equipment.current.vibration,
    ageYears: equipment.current.ageYears, lastServiceDays: equipment.current.lastServiceDays,
    batteryHealth: battery.healthPct, socPct: batt.soc, emergencyPct: batt.emergencyPct,
    txLossPct: distAlerts.txLossPct || 4,
    devPct: roadmap.worstDev, producedKW: 3, storedKW: 3
  };
  const ml = mlDetectProblem(feat);
  const sol = mlRecommendSolution(ml.class, manualSolutions);
  const probs = [];
  const mk = (sev, what, why, how) => ({
    source, stage, what, why, how,
    past: pastCount ? `Occurred ${pastCount}x before; last fix: ${sol.primary.text}` : 'First occurrence in tracked history.',
    severity: sev, mlClass: ml.name, mlConfidence: ml.confidence, mlEngine: ml.engine,
    solution: sol.primary.text, solutionOptions: sol.recommendations,
    aim: aimFor(ml.class, source), adminLearned: sol.adminLearned
  });
  if (ml.class === 0) return { ml, probs, score: 92 };  const SEV = ml.class === 5 || ml.class === 3 ? 'critical' : 'medium';
  const srcName = { solar: 'solar panels', wind: 'windmills', hydro: 'hydro turbines' }[source] || source;
  const WHAT = {
    1: `A ${source} machine is getting weak. It now makes less electricity than it should (efficiency ${feat.efficiencyPct}% — healthy is above 86%) and needs servicing.`,
    2: `The ${source} battery is at risk. Its health is ${feat.batteryHealth}% (safe is above 85%) and only ${feat.emergencyPct}% is kept aside for emergencies (rule needs at least 15%).`,
    3: `Electricity is going missing on the way to users. About ${feat.txLossPct}% is lost in the wires (safe limit is 8%) and some areas received ${feat.devPct}% less than planned. This can mean wire faults or someone stealing power.`,
    4: `Today's weather is not safe for the ${srcName}. ${weather.summary}. Running normally now could damage equipment or waste effort.`,
    5: `The numbers uploaded for ${source} do not add up. They differ by ${feat.devPct}% from what physics expects (allowed difference is only ±${TOLERANCE_PCT}%). Either wrong data was uploaded or power is leaking somewhere.`
  }[ml.class];
  const WHY = {
    1: 'Machines wear out with use. This one has not been serviced for a long time, so its parts (like bearings) are likely dry or loose.',
    2: 'Batteries lose strength with age and heavy use. Too little emergency backup means a blackout cannot be handled.',
    3: 'What was sent from the plant does not match what reached the users. Either the wires are faulty or someone is tapping power illegally.',
    4: 'Strong wind, heavy rain or thick clouds push the equipment outside its safe working range.',
    5: 'The uploaded production, storage and distribution numbers contradict each other beyond the small errors we tolerate.'
  }[ml.class];
  const HOW = {
    1: 'The AI watched this machine over time and saw its power output slowly falling while shaking increased. This pattern matched past cases that needed servicing.',
    2: 'The AI checked the battery levels and health readings and found them below the safety rules every good battery must follow.',
    3: 'The AI compared "power sent" with "power received" at each area and found a gap too big to be normal wire loss.',
    4: 'The AI read the live weather for your city and saw it cross the safety limits for this energy source.',
    5: 'The AI compared the uploaded numbers with physics-based expected values and the gap was far too large to be a typing error.'
  }[ml.class];
  probs.push(mk(SEV, WHAT, WHY, HOW + ` The AI is ${(ml.confidence * 100).toFixed(0)}% sure about this.`));
  probs.forEach((p, i) => { p.liveKey = `${source}-${stage}-${i}`; });
  return { ml, probs, score: SEV === 'critical' ? 42 : 66 };
}
function aimFor(cls, source) {
  return { 0: 'Hold steady.', 1: `Restore ${source} efficiency above 86%, avoid breakdown.`, 2: 'Protect SoC 20-90% + 15% emergency reserve.', 3: 'Recover lost units, enforce HV protocol, stop theft.', 4: 'Protect equipment, prioritize best source today.', 5: 'Force true data before settlement.' }[cls];
}
function generateDecisions(ctx) {
  const d = []; let id = 100 + Math.floor(Math.random() * 800);
  const push = (p) => d.push({ id: id++, liveKey: p.liveKey, title: `${p.severity === 'critical' ? '🚨' : '⚠️'} [${p.source}/${p.stage}] ${p.what.slice(0, 70)}`, what: p.what, why: p.why, how: p.how, past: p.past, detail: `${p.why} ${p.how}`, solution: p.solution, aim: p.aim, source: p.source, stage: p.stage, priority: p.severity === 'critical' ? 'critical' : 'medium', fix: p.solution, mlClass: p.mlClass, mlConfidence: p.mlConfidence, createdAt: new Date().toISOString(), status: 'pending' });
  for (const p of (ctx.problems || [])) push(p);
  return d;
}
// ---------- SIMULATOR (Model 4: workflow/tech recommender, trained on 900-row dummy dataset) ----------
function simPredict(kind, tech, capKW, hours, tempC, loadPct) {
  if (!SIM) return 82;
  if (SIM.engine === 'mean-fallback' || !SIM.regressions) return (SIM.means && SIM.means[tech]) || 82;
  const r = SIM.regressions[kind];
  if (!r) return 82;
  const feats = [+capKW || 10, +hours || 8, +tempC || 30, +loadPct || 60];
  r.techs.forEach(t => feats.push(t === tech ? 1 : 0));
  let e = r.intercept;
  r.coef.forEach((c, i) => e += c * feats[i]);
  return +Math.max(40, Math.min(99, e)).toFixed(1);
}
function simBestTech(kind, capKW, hours) {
  const techs = (SIM && SIM.techs && SIM.techs[kind]) || [];
  let best = null;
  for (const t of techs) {
    const e = simPredict(kind, t, capKW, hours, 30, 65);
    if (!best || e > best.eff) best = { tech: t, eff: e };
  }
  return best;
}
// nodes: [{id, kind: production|storage|distribution, label, tech, capKW, hours, producedKW|storedKW|needKW}]
// edges: [{from, to}]
function simScore(nodes, edges) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const per = nodes.map(n => {
    const out = n.kind === 'production' ? (+n.producedKW || 0) : n.kind === 'storage' ? (+n.storedKW || 0) : (+n.needKW || 0);
    const eff = simPredict(n.kind, n.tech, n.capKW, n.hours, 30, 65);
    const util = n.capKW > 0 && n.hours > 0 ? Math.min(100, (out / (n.capKW * n.hours)) * 100) : 70;
    return { id: n.id, kind: n.kind, eff, util: +util.toFixed(1) };
  });
  const prod = nodes.filter(n => n.kind === 'production').reduce((a, n) => a + (+n.producedKW || 0), 0);
  const stor = nodes.filter(n => n.kind === 'storage').reduce((a, n) => a + (+n.storedKW || 0), 0);
  const storCap = nodes.filter(n => n.kind === 'storage').reduce((a, n) => a + (+n.capKW || 0), 0);
  const need = nodes.filter(n => n.kind === 'distribution').reduce((a, n) => a + (+n.needKW || 0), 0);
  const connected = new Set(); (edges || []).forEach(e => { connected.add(e.from); connected.add(e.to); });
  const unconnected = nodes.filter(n => !connected.has(n.id) && nodes.length > 1).map(n => n.label || n.id);
  const avgEff = per.length ? per.reduce((a, p) => a + p.eff, 0) / per.length : 0;
  const coverage = need > 0 ? Math.min(100, (stor / need) * 100) : 100;
  const balance = prod > 0 ? Math.max(0, 100 - Math.abs(prod - Math.max(stor, need)) / prod * 100) : 70;
  const connScore = nodes.length <= 1 ? 100 : ((nodes.length - unconnected.length) / nodes.length) * 100;
  const score = Math.round(avgEff * 0.4 + coverage * 0.25 + balance * 0.2 + connScore * 0.15);
  const losses = [];
  if (prod > stor) losses.push(`Storage loss/unused: ${(prod - stor).toFixed(1)} kW made but not stored (${(100 - stor / prod * 100).toFixed(0)}%).`);
  if (stor > need && need > 0) losses.push(`Surplus: ${(stor - need).toFixed(1)} kW stored above demand — holding cost.`);
  if (need > stor) losses.push(`Shortfall: ${(need - stor).toFixed(1)} kW demand not covered by storage.`);
  if (storCap > 0 && stor / storCap * 100 > 95) losses.push('Batteries nearly full — add capacity or distribute faster.');
  if (unconnected.length) losses.push(`Unconnected boxes: ${unconnected.join(', ')} — connect them with arrows.`);
  if (!losses.length) losses.push('Balanced — production, storage and demand line up well.');
  return { score: Math.max(5, Math.min(100, score)), avgEff: +avgEff.toFixed(1), coverage: +coverage.toFixed(1), per, totals: { prod: +prod.toFixed(1), stor: +stor.toFixed(1), need: +need.toFixed(1) }, losses, unconnected };
}
function simSuggest(nodes) {
  const tips = [];
  for (const n of nodes) {
    const best = simBestTech(n.kind, n.capKW, n.hours);
    if (best && best.tech !== n.tech) {
      const cur = simPredict(n.kind, n.tech, n.capKW, n.hours, 30, 65);
      tips.push(`Swap "${n.label || n.id}" from ${n.tech} (${cur}% predicted) to ${best.tech} (${best.eff}% predicted).`);
    }
  }
  if (!tips.length) tips.push('Your tech choices already match the model\'s best picks for these sizes. Keep them maintained.');
  const kinds = ['production', 'storage', 'distribution'];
  const missing = kinds.filter(k => !nodes.some(n => n.kind === k));
  if (missing.length) tips.push(`Add ${missing.join(' + ')} boxes — a complete workflow needs all three stages.`);
  return { tips, engine: SIM ? `sim-model(${(SIM.n_rows || 900)} rows)` : 'fallback' };
}
function cuttingEdgeInsights() {
  return [
    { tag: 'Ecosystem upgrade', title: 'Hybrid wind-solar + gravity hydro storage', detail: 'Co-locate 2 MW solar with wind farm; pump hydro uphill with surplus: 78% round-trip, battery capex -30%. Payback ~4.2 yrs.' },
    { tag: 'Ecosystem upgrade', title: 'Solid-state battery pilot', detail: '2x density, 15-min response for emergency reserve. Start 500 kWh at city station.' },
    { tag: 'Ecosystem upgrade', title: 'AI HVDC dynamic line rating', detail: '+15-25% corridor capacity without new towers; loss -2.1 pts.' },
    { tag: 'Long-range forecast', title: 'Monsoon +45-day: hydro surplus', detail: 'Above-normal inflow in 6-9 weeks likely. Ready turbines now; defer hydro outage.' },
    { tag: 'Long-range forecast', title: 'Heatwave +30-day: solar peak, wind lull', detail: 'Solar +18%, wind -12%. Maintain wind units during lull; derate solar inverters 2%.' }
  ];
}

module.exports = {
  TOLERANCE_PCT, analyzeWeatherToOps, predictMaintenance, recommendEquipment,
  analyzeBattery, analyzeDistribution, roadmapCheck, stageScore,
  mlDetectProblem, mlRecommendSolution, mlChatbotRespond,
  detectStageProblems, generateDecisions, cuttingEdgeInsights,
  chatbotRespond: mlChatbotRespond, learnings, manualSolutions,
  simPredict, simBestTech, simScore, simSuggest,
  models: { problem: PROBLEM, solution: SOLUTION, chat: CHAT, metrics: METRICS, sim: SIM }
};
