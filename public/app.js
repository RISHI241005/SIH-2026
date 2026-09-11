/* UrjaSetu SPA — plan-strict: Home, Login(scale+role), Admin x7, Uploaders x4, loaders */
let S = { token: localStorage.getItem('urja_tok') || '', user: JSON.parse(localStorage.getItem('urja_user') || 'null'), route: 'Dashboard', src: 'wind', stage: 'forecast', city: 'kolkata', scale: 'small', charts: [] };
const $ = (id) => document.getElementById(id);
const LOAD_TIPS = ['Tip: clouds cut solar 15-30% — AI shifts load to wind/hydro.', 'Tip: wind 12-90 km/h is the sweet band for windmills.', 'Tip: keep 15% battery as emergency reserve, always.', 'Tip: transmit at HV 132-220 kV to cut losses.', 'Tip: upload daily before 18:00 — a miss flags inconsistency.', 'Tip: ±7% data deviation tolerated; beyond = FAULTY.'];
function showLoader(title) { $('loader').classList.remove('hidden'); $('loadTitle').textContent = title || 'Loading…'; $('loadTip').textContent = LOAD_TIPS[Math.floor(Math.random() * LOAD_TIPS.length)]; }
function hideLoader() { $('loader').classList.add('hidden'); }
const api = async (p, o = {}) => {
  const r = await fetch(p, { ...o, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token, ...(o.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
};
function killCharts() { S.charts.forEach(c => { try { c.destroy(); } catch {} }); S.charts = []; }

/* ---------- theme (dark / light) ---------- */
function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('urja_theme', dark ? 'dark' : 'light');
  document.querySelectorAll('.icon-btn').forEach(b => b.textContent = dark ? '☀️' : '🌙');
}
(function initTheme() {
  if (localStorage.getItem('urja_theme') === 'dark') {
    document.body.classList.add('dark');
    document.querySelectorAll('.icon-btn').forEach(b => b.textContent = '☀️');
  }
})();

/* ---------- home tips with context background images ---------- */
const TIPS = [
  { t: 'What is renewable energy? Sun, wind and flowing water refill naturally — no fuel cost, low carbon, but weather-varying, so we forecast + store.', img: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=60' },
  { t: 'Why does weather matter? Clouds cut solar, calm cuts wind, rain swells hydro. The Forecast stage turns weather into daily ops windows.', img: 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=800&q=60' },
  { t: 'Solar 101: peak 10:00-15:30 on clear days. Dust film alone steals ~6% — cleaning cycles pay back fast.', img: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=60' },
  { t: 'Wind 101: 12-90 km/h runs turbines; below 12 park extras; above 90 feather blades and shut down.', img: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=60' },
  { t: 'Hydro 101: heavy upstream rain? Release through turbines NOW — a dam cannot hold flood water long.', img: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=800&q=60' },
  { t: 'Storage 101: keep battery charge 20-90% and 15% as untouchable emergency savings for blackouts.', img: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=60' },
  { t: 'Distribution 101: high-voltage lines waste far less power. A sudden big shortfall usually means wire fault or theft — send a patrol.', img: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=60' }
];
let tipI = 0;
function paintTip() {
  if (!$('tipBox')) return;
  $('tipBox').textContent = TIPS[tipI].t;
  $('tipN').textContent = (tipI + 1) + '/' + TIPS.length;
  const bg = $('tipBg');
  if (bg) { bg.style.opacity = 0; setTimeout(() => { bg.style.backgroundImage = `url('${TIPS[tipI].img}')`; bg.style.opacity = 1; }, 200); }
}
function nextTip() { tipI = (tipI + 1) % TIPS.length; paintTip(); }
function prevTip() { tipI = (tipI - 1 + TIPS.length) % TIPS.length; paintTip(); }
setInterval(() => { if (!$('homeView') || $('homeView').classList.contains('hidden')) return; tipI = (tipI + 1) % TIPS.length; paintTip(); }, 5000);

/* ---------- home FAQ (tap ▼ to open) ---------- */
const FAQS = [
  ['What is renewable energy in simple words?', 'Power made from things nature refills for free — sunlight, wind and flowing water. No fuel to buy, almost no smoke, but output changes with weather, so we forecast and store.'],
  ['Why not just use coal or diesel?', 'Coal and diesel pollute the air, keep getting costlier, and can run out. Renewables have free fuel and let a hostel, village or city make its own clean power.'],
  ['How do solar panels, windmills and hydro work?', 'Solar panels turn sunlight directly into electricity. Windmills and hydro turbines spin a generator with moving air or water. All three send power to batteries first, then to users.'],
  ['What happens on cloudy or windless days?', 'That is why we store power. Batteries cover nights and calm days, and the AI picks the best source each day from the weather forecast. A 15% emergency reserve is always kept aside.'],
  ['How does this website catch power theft?', 'It compares "power sent" with "power received" at every step. Small differences (±7%) are normal; big sudden gaps mean wire faults or illegal tapping, and the AI raises an alert.'],
  ['Who uploads data and how often?', 'Three uploaders — production, storage and transmission — upload every day before 6 PM: exact numbers plus notes, which the AI checks.'],
  ['What does the admin actually do?', 'The admin watches the dashboard, opens problems written in plain words, and either approves the AI\'s fix, rejects it with a reason, or writes his own solution after researching with the AI.'],
  ['What is the emergency storage?', '15% of battery capacity locked away only for blackouts and emergencies — never used for daily supply. The AI warns if it falls below the rule.']
];
function paintFaq() {
  const box = $('faqBox'); if (!box) return;
  box.innerHTML = FAQS.map((f, i) => `<div class="faq"><button onclick="toggleFaq(${i})"><span>${f[0]}</span><span id="faqA${i}">▼</span></button><p id="faqP${i}" class="hidden">${f[1]}</p></div>`).join('');
}
function toggleFaq(i) {
  const p = $('faqP' + i); if (!p) return;
  const open = p.classList.toggle('hidden');
  $('faqA' + i).textContent = open ? '▼' : '▲';
}
function showHome() { delete document.body.dataset.section; $('homeView').classList.remove('hidden'); $('authView').classList.add('hidden'); $('appView').classList.add('hidden'); paintTip(); loadStats(); }
async function loadStats() {
  try {
    const j = await (await fetch('/api/stats')).json();
    if ($('stUsers')) $('stUsers').textContent = j.customers;
    if ($('stProd')) $('stProd').textContent = j.totalProduction;
    if ($('stDist')) $('stDist').textContent = j.totalDistribution;
  } catch { }
}
/* typewriter heading: types UrjaSetu, backspaces, repeats */
(function typewriter() {
  const word = 'UrjaSetu';
  let i = 0, del = false;
  function tick() {
    const e = $('typeHead');
    if (!e) return setTimeout(tick, 1000);
    e.textContent = word.slice(0, i);
    if (!del) { i++; if (i > word.length) { del = true; return setTimeout(tick, 1800); } setTimeout(tick, 240); }
    else { i--; if (i <= 0) { i = 0; del = false; setTimeout(tick, 600); } else setTimeout(tick, 100); }
  }
  tick();
})();
function showLogin() { delete document.body.dataset.section; $('homeView').classList.add('hidden'); $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); }
function setScale(s) { S.scale = s; [...$('scaleSeg').children].forEach(b => b.classList.toggle('on', b.dataset.s === s)); }
function togglePass(id, btn) {
  const el = $(id); if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  if (btn) btn.innerHTML = show ? EYE_OFF : EYE;
}
const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
$('tabLogin').onclick = () => { $('tabLogin').classList.add('on'); $('tabReg').classList.remove('on'); $('loginBox').classList.remove('hidden'); $('regBox').classList.add('hidden'); };
$('tabReg').onclick = () => { $('tabReg').classList.add('on'); $('tabLogin').classList.remove('on'); $('regBox').classList.remove('hidden'); $('loginBox').classList.add('hidden'); };

async function doLogin() {
  showLoader('Logging in…');
  try { const j = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('liEmail').value, password: $('liPass').value }) }); enter(j); }
  catch (e) { hideLoader(); $('authErr').textContent = e.message; }
}
async function doRegister() {
  showLoader('Creating account…');
  try {
    const j = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: $('rgName').value, email: $('rgEmail').value, password: $('rgPass').value, role: $('roleSel').value, scale: S.scale }) });
    enter(j);
  } catch (e) { hideLoader(); $('authErr').textContent = e.message; }
}
function enter(j) { S.token = j.token; S.user = j.user; localStorage.setItem('urja_tok', j.token); localStorage.setItem('urja_user', JSON.stringify(j.user)); hideLoader(); boot(); }
function logout() { S.token = ''; S.user = null; localStorage.clear(); location.reload(); }

function navItems() {
  if (S.user.role === 'admin') return ['Dashboard', 'Energy Tracking', 'Simulation', 'Approvals', 'AI Desk', 'Forecasts', 'Feedback', 'Complaints'];
  return ['Dashboard', 'Upload'];
}
function boot() {
  if (!S.token || !S.user) { showHome(); return; }
  $('homeView').classList.add('hidden'); $('authView').classList.add('hidden'); $('appView').classList.remove('hidden');
  const rn = { admin: 'Admin', production_uploader: 'Production Uploader', storage_uploader: 'Storage Uploader', transmission_uploader: 'Transmission Uploader' }[S.user.role];
  $('userName').textContent = `${S.user.name} · ${rn} · ${S.user.scale === 'large' ? 'Large' : 'Small'} Scale`;
  $('roleBadge').textContent = `${rn} · ${S.user.scale} scale`.toUpperCase();
  $('nav').innerHTML = navItems().map(n => `<button data-r="${n}" class="${n === S.route ? 'on' : ''}" onclick="go('${n}')">${n}</button>`).join('');
  go(S.route);
}
function go(r) { S.route = r; document.body.dataset.section = r; [...$('nav').children].forEach(b => b.classList.toggle('on', b.dataset.r === r)); render(); }
async function render() {
  const p = $('page'); killCharts(); showLoader('Loading ' + S.route + '…');
  try {
    if (S.user.role !== 'admin') {
      if (S.route === 'Dashboard') return upDash(p);
      return upUpload(p);
    }
    if (S.route === 'Dashboard') return adminDash(p);
    if (S.route === 'Energy Tracking') return tracking(p);
    if (S.route === 'Simulation') return simulation(p);
    if (S.route === 'Approvals') return approvals(p);
    if (S.route === 'AI Desk') return aiDesk(p);
    if (S.route === 'Forecasts') return forecasts(p);
    if (S.route === 'Feedback') return feedback(p);
    return complaints(p);
  } catch (e) { hideLoader(); p.innerHTML = `<div class="card"><span class="pill bad">Error</span><p>${e.message}</p></div>`; }
}

/* ================= ADMIN: DASHBOARD ================= */
async function adminDash(p) {
  const d = await api('/api/dashboard?city=' + S.city);
  hideLoader();
  const short = (t) => String(t || '').replace(/^[🚨⚠️\s]*/, '').slice(0, 75);
  p.innerHTML = `<div class="dash">
  <h2 style="font-size:30px;margin:4px 0">Dashboard ⚡ <span class="pill info">${S.user.scale} scale</span></h2>
  <p class="mut">Your whole plant at a glance — tap any card to explore.</p>
  <div class="grid g4">
    <div class="card kpi" onclick="go('Energy Tracking')"><div class="t">PRODUCED</div><div class="n">${d.totals.total} <small style="font-size:13px">kW</small></div><div class="mut">Wind ${d.totals.wind} · Solar ${d.totals.solar} · Hydro ${d.totals.hydro}</div></div>
    <div class="card kpi" onclick="go('Energy Tracking')"><div class="t">USED</div><div class="n">${d.usages.total} <small style="font-size:13px">kW</small></div><div class="mut">Wind ${d.usages.wind} · Solar ${d.usages.solar} · Hydro ${d.usages.hydro}</div></div>
    <div class="card kpi" onclick="go('Approvals')"><div class="t">🔔 PENDING APPROVALS</div><div class="n">${d.pendingCount}</div><div class="mut">${d.pendingStored} stored + ${d.pendingAuto} live</div></div>
    <div class="card kpi" onclick="go('Energy Tracking')"><div class="t">🚨 URGENT</div><div class="n">${d.alerts.length}</div><div class="mut">tap below for detail</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>🚨 Needs immediate action (top 4)</h3>
    ${d.alerts.length ? `<div class="grid g2">${d.alerts.map(a => `<div class="dec critical" onclick="alertGo('${a.liveKey || ''}')"><b>${short(a.title)}</b></div>`).join('')}</div>` : '<p><span class="pill ok">All clear</span> Nothing urgent.</p>'}
  </div>
  <div class="card" style="margin-top:14px"><h3>🥧 Produced energy per source (kW)</h3><p class="mut">Most recent production uploads.</p>
    <div class="grid g3">
      <div><h3 style="text-align:center">🌬 Wind</h3><canvas id="pieW"></canvas></div>
      <div><h3 style="text-align:center">☀ Solar</h3><canvas id="pieS"></canvas></div>
      <div><h3 style="text-align:center">🌊 Hydro</h3><canvas id="pieH"></canvas></div>
    </div></div>
  </div>`;
  const pieColors = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const mkPie = (id, series) => {
    if (!series.length) return;
    S.charts.push(new Chart($(id), { type: 'pie', data: { labels: series.map(x => x.day), datasets: [{ data: series.map(x => x.kw), backgroundColor: pieColors }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } }));
  };
  mkPie('pieW', d.prodSeries.wind); mkPie('pieS', d.prodSeries.solar); mkPie('pieH', d.prodSeries.hydro);
}
function alertGo(key) {
  if (!key) return go('Approvals');
  S.openAlert = key; go('Approvals');
}

/* ================= ADMIN: ENERGY TRACKING ================= */
async function tracking(p) {
  const t = await api(`/api/tracking?source=${S.src}&city=${S.city}`);
  window._T = t; hideLoader();
  const st = (k) => t.stages.find(s => s.key === k);
  const flag = (s) => s.hasProblem ? '<span class="flag">!</span>' : '';
  const hb = (h) => `<div class="hbar"><i style="width:${h}%;background:${h > 80 ? '#16a34a' : h > 60 ? '#f59e0b' : '#dc2626'}"></i></div>`;
  p.innerHTML = `
  <h2 style="font-size:30px;margin:4px 0">Energy Tracking 🔍</h2>
  <div class="seg zones">${['solar', 'wind', 'hydro'].map(s => `<button class="${s === t.source ? 'on' : ''}" onclick="S.src='${s}';render()">${s === 'wind' ? '🌬 Wind' : s === 'solar' ? '☀ Solar' : '🌊 Hydro'}</button>`).join('')}</div>
  <div class="seg cities">${['kolkata', 'delhi', 'mumbai', 'hyderabad'].map(c => `<button class="${c === S.city ? 'on' : ''}" onclick="S.city='${c}';render()">📍 ${c[0].toUpperCase() + c.slice(1)}</button>`).join('')}</div>
  <div class="card flow-card"><h3>Energy Flow</h3><p class="mut">Click a stage to explore.</p>
    <div class="flow">${t.stages.map(s => `<div class="fstep ${s.hasProblem ? 'bad' : ''}" onclick="stageGo('${s.key}')">${flag(s)}<b>${s.key.toUpperCase()}</b><span class="mut">${s.health}</span></div>`).join('')}</div></div>
  <h3 style="margin:20px 0 4px">Data</h3>
  <div class="grid g3">
    <div class="card kpi"><div class="t">PRODUCED ENERGY</div><div class="n">${t.totals.produced} <small style="font-size:13px">kW</small></div></div>
    <div class="card kpi"><div class="t">STORED ENERGY</div><div class="n">${t.totals.stored} <small style="font-size:13px">kW (${t.totals.storedPct}%)</small></div></div>
    <div class="card kpi"><div class="t">DISTRIBUTED ENERGY</div><div class="n">${t.totals.distributed} <small style="font-size:13px">kW (${t.totals.distributedPct}%)</small></div></div>
  </div>
  <div id="stageBox" style="margin-top:18px"></div>`;
  trackingStage();
}
/* stage click: instant loader feedback, then paint */
function stageGo(k) {
  S.stage = k;
  showLoader('Opening ' + k + ' stage…');
  setTimeout(() => { hideLoader(); trackingStage(); }, 450);
}
function trackingStage() {
  const t = window._T; if (!t) return;
  const s = t.stages.find(x => x.key === S.stage) || t.stages[0];
  const hb = (h) => `<div class="hbar"><i style="width:${h}%;background:${h > 80 ? '#16a34a' : h > 60 ? '#f59e0b' : '#dc2626'}"></i></div><small class="mut">Health ${h}/100 · ${s.performance}</small>`;
  const shortWhat = (w) => String(w).split('.')[0].slice(0, 90);
  const activeList = s.problems.map(pr => `<div class="dec ${pr.severity}" onclick='probDetail(${JSON.stringify(pr.id)})'><b>${shortWhat(pr.what)}</b><br><span class="mut">Tap for full detail →</span></div>`).join('') || '<p class="mut">None — all OK. ✅</p>';
  const futureList = s.predicted.map((x, i) => `<div class="dec low pred" onclick="predDetail(${i})"><b>~${x.confidence}% likely:</b> ${shortWhat(x.text)}<br><span class="mut">Tap for early solution →</span></div>`).join('') || '<p class="mut">None predicted. ✅</p>';
  // forecast stage: only Detected Problems in 2 subsections (no weather dump)
  if (s.key === 'forecast') {
    $('stageBox').innerHTML = `<div class="card"><h3>Detected Problems ${s.hasProblem ? '<span class="pill bad">NEEDS ATTENTION</span>' : '<span class="pill ok">healthy</span>'}</h3>${hb(s.health)}
    <h3 style="margin-top:12px">Active Problems (${s.problems.length})</h3>${activeList}
    <h3>Future Predicted Problems (${s.predicted.length})</h3><p class="mut">ML pattern prediction from weather data.</p>${futureList}</div>`;
    return;
  }
  let statsHtml = '';
  if (s.key === 'production') statsHtml = `<p>Produced <b>${s.stats.producedKW} kW</b> (calc ${s.stats.calcKW}) · 30-day avg ${s.stats.historyAvg} kW/day</p><p>Equipment: ${s.stats.equipment.ageYears}y · eff ${s.stats.equipment.efficiencyPct}% · vib ${s.stats.equipment.vibration} · service ${s.stats.equipment.lastServiceDays}d ago</p>${s.stats.issues.map(i => `<p><span class="pill ${i.severity === 'high' ? 'bad' : i.severity === 'medium' ? 'warn' : 'ok'}">${i.severity}</span> ${i.text}</p>`).join('')}<p><b>New tech to boost production:</b></p>${s.stats.upgrades.map(u => `<p>✨ <b>${u.name}</b> — ${u.benefit}</p>`).join('')}`;
  if (s.key === 'storage') statsHtml = `<p>Stored ${s.stats.storedMWh}/${s.stats.capacityMWh} MWh · Health ${s.stats.healthPct}% · Emergency ${s.stats.emergencyMWh} MWh · Cycles ${s.stats.cycles}</p>${s.stats.analysis.notes.map(n => `<p><span class="pill ${n.level === 'danger' ? 'bad' : n.level === 'warn' ? 'warn' : 'ok'}">${n.level || 'info'}</span> ${n.text || (n.k + ': ' + n.v)}</p>`).join('')}<p class="mut">Emergency units are reserved for future/emergency use and managed identically.</p>`;
  if (s.key === 'distribution') statsHtml = `<p>Transmitted <b>${s.stats.transmittedMWh} MWh</b> · Loss <b>${s.stats.txLossPct}%</b></p><table><tr><th>Station</th><th>Exp</th><th>Act</th><th>Protocol</th></tr>${s.stats.stations.map(x => `<tr><td>${x.name}</td><td>${x.expectedMWh}</td><td>${x.actualMWh}</td><td>${x.protocolOk ? '✅' : '❌ ' + x.detail}</td></tr>`).join('')}</table>${s.stats.alerts.map(a => `<p><span class="pill ${a.level === 'danger' ? 'bad' : a.level === 'warn' ? 'warn' : 'ok'}">${a.level}</span> ${a.text}</p>`).join('')}<p><b>Verdict ${s.stats.roadmap.verdict}</b> — ${s.stats.roadmap.explanation}</p>`;
  $('stageBox').innerHTML = `<div class="card"><h3>${s.key.toUpperCase()} stage ${s.hasProblem ? '<span class="pill bad">❗ NEEDS ATTENTION</span>' : '<span class="pill ok">healthy</span>'}</h3>${hb(s.health)}<div style="margin-top:10px">${statsHtml}</div>
    <h3>Active problems (${s.problems.length})</h3>${s.problems.map(pr => `<div class="dec ${pr.severity}" onclick='probDetail(${JSON.stringify(pr.id)})'><b>${shortWhat(pr.what)}</b><br><span class="mut">Tap for full detail →</span></div>`).join('') || '<p class="mut">None — all OK. ✅</p>'}
    <h3>🔮 Predicted problems (click to see early fix)</h3>${s.predicted.map((x, i) => `<div class="dec low pred" onclick="predDetail(${i})"><b>~${x.confidence}% likely:</b> ${shortWhat(x.text)}<br><span class="mut">Tap to view what may happen + suggested early solution →</span></div>`).join('') || '<p class="mut">None predicted. ✅</p>'}</div>`;
}
function predDetail(i) {
  const t = window._T; if (!t) return;
  const s = t.stages.find(x => x.key === S.stage) || t.stages[0];
  const x = s.predicted[i]; if (!x) return;
  $('modalBody').innerHTML = `<span class="pill warn">🔮 EARLY WARNING · ~${x.confidence}% likely</span> <span class="pill info">${t.source} / ${s.key}</span>
    <h3>${x.text}</h3><p><b>What may happen:</b> ${x.detail || x.text}</p>
    <p><b>🛡 Suggested early solution (act now, worry less later):</b> ${x.earlySolution || 'Watch closely and keep a backup ready.'}</p>
    <p class="mut">This has NOT happened yet. Acting early is cheaper than repairing later.</p>
    <div class="row"><button class="btn g" onclick="closeModal()">Got it ✓</button><button class="btn o" onclick="closeModal();go('AI Desk')">Ask AI about it →</button></div>`;
  $('modal').classList.remove('hidden');
}
function probDetail(pid) {
  const t = window._T;
  const pr = t.stages.flatMap(s => s.problems).find(x => String(x.id) === String(pid));
  if (!pr) return;
  window._P = pr;
  $('modalBody').innerHTML = `
    <span class="pill info">${pr.source} / ${pr.stage}</span> <span class="pill ${pr.severity === 'critical' ? 'bad' : 'warn'}">${pr.severity}</span>
    <h3>${pr.what}</h3>
    <p><b>What is it:</b> ${pr.what}</p><p><b>Why:</b> ${pr.why}</p><p><b>How it happened (AI perception):</b> ${pr.how}</p>
    <p><b>Past occurrence:</b> ${pr.past}</p>
    <p><b>🤖 AI solution:</b> ${pr.solution}</p>
    ${pr.solutionOptions ? `<p class="mut">Options: ${pr.solutionOptions.map(o => `#${o.solution_id} (${(o.prob * 100).toFixed(0)}%) ${o.text}`).join(' · ')}</p>` : ''}
    <p><b>Aim:</b> ${pr.aim}</p>
    <div class="row"><button class="btn g" onclick="promoteAndDecide('approve')">Approve ✓</button><button class="btn r" onclick="askReject()">Reject ✕</button><button class="btn o" onclick="goDraft()">Make a solution ✍</button></div>
    <div id="decZone"></div>`;
  $('modal').classList.remove('hidden');
}
async function promoteAndDecide(action) {
  const pr = window._P;
  showLoader('Saving decision…');
  try {
    const d = await api('/api/decisions/promote', { method: 'POST', body: JSON.stringify({ source: pr.source, stage: pr.stage, what: pr.what, why: pr.why, how: pr.how, past: pr.past, solution: pr.solution, aim: pr.aim, severity: pr.severity, liveKey: pr.liveKey || pr.id }) });
    await api(`/api/decisions/${d.id}/${action}`, { method: 'POST', body: JSON.stringify(action === 'reject' ? { reason: 'Rejected from tracking view' } : {}) });
    hideLoader(); closeModal(); go('Approvals');
  } catch (e) { hideLoader(); alert(e.message); }
}
function askReject() { $('decZone').innerHTML = `<input id="rejR" placeholder="Rejection reason in simple words (required, teaches the AI)"><button class="btn r" onclick="promoteReject()">Submit rejection</button>`; }
async function promoteReject() {
  const pr = window._P; const reason = ($('rejR') || {}).value || '';
  if (!reason) return alert('Reason required');
  showLoader('Saving…');
  try {
    const d = await api('/api/decisions/promote', { method: 'POST', body: JSON.stringify({ source: pr.source, stage: pr.stage, what: pr.what, why: pr.why, how: pr.how, past: pr.past, solution: pr.solution, aim: pr.aim, severity: pr.severity, liveKey: pr.liveKey || pr.id }) });
    await api(`/api/decisions/${d.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    hideLoader(); closeModal(); go('Approvals');
  } catch (e) { hideLoader(); alert(e.message); }
}
/* Make-a-Solution -> AI Desk with the problem pinned on top + side chatbot */
function goDraft() {
  S.draft = { ...(window._P || {}) };
  closeModal();
  go('AI Desk');
}
function closeModal() { $('modal').classList.add('hidden'); }

/* ================= ADMIN: SIMULATION ================= */
function simBox(n, eff, tap) {
  const nums = n.kind === 'production' ? `${n.producedKW || 0} kW made · ${n.capKW || 0}kW × ${n.hours || 0}h`
    : n.kind === 'storage' ? `${n.storedKW || 0}/${n.capKW || 0} kW stored`
    : `${n.needKW || 0} kW needed`;
  const click = tap ? ` onclick="${tap}('${n.id}')"` : '';
  return `<div class="sim-box k-${n.kind}${S.sel === n.id ? ' sel' : ''}" data-node="${n.id}"${click}>
    <b>${n.label || n.id}</b><span class="pill info">${n.tech || ''}</span><br><small>${nums}</small>
    ${eff != null ? `<br><small class="mut">model efficiency ${eff}%</small>` : ''}${n.from ? `<br><small class="mut">${n.from}</small>` : ''}__DEL__</div>`;
}
function simScoreHtml(sc) {
  if (!sc) return '';
  return `<div class="card" style="margin-top:12px"><h3>📊 Overall workflow score: <b style="font-size:28px">${sc.score}</b>/100</h3>
  <div class="hbar"><i style="width:${sc.score}%;background:${sc.score > 80 ? '#16a34a' : sc.score > 60 ? '#f59e0b' : '#dc2626'}"></i></div>
  <p class="mut">Made ${sc.totals.prod} · Stored ${sc.totals.stor} · Needed ${sc.totals.need} kW · Avg tech efficiency ${sc.avgEff}% · Demand covered ${sc.coverage}%</p>
  ${sc.losses.map(l => `<p>• ${l}</p>`).join('')}</div>`;
}
function drawWires(canvasId, svgId, edges) {
  const cv = $(canvasId), svg = $(svgId); if (!cv || !svg) return;
  const W = cv.offsetWidth, H = cv.offsetHeight; if (!W || !H) return;
  const r = cv.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = `<defs><marker id="ah${svgId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#16a34a" stroke-width="1.6"/></marker></defs>` + (edges || []).map(e => {
    const a = cv.querySelector(`[data-node="${e.from}"]`), b = cv.querySelector(`[data-node="${e.to}"]`);
    if (!a || !b) return '';
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return `<line x1="${ra.right - r.left}" y1="${ra.top + ra.height / 2 - r.top}" x2="${rb.left - r.left}" y2="${rb.top + rb.height / 2 - r.top}" stroke="#16a34a" stroke-width="2" marker-end="url(#ah${svgId})"/>`;
  }).join('');
}
async function simulation(p) {
  const [cur, techs] = await Promise.all([api('/api/simulation/current'), api('/api/simulation/techs')]);
  window._SIM = cur; window._SIMTECHS = techs.techs; hideLoader();
  const effOf = (id) => { const f = (cur.score.per || []).find(x => x.id === id); return f ? f.eff : null; };
  const col = (kind, title) => `<div class="sim-col"><h3>${title}</h3>${cur.nodes.filter(n => n.kind === kind).map(n => simBox(n, effOf(n.id), null).replace('__DEL__', '')).join('') || '<p class="mut">—</p>'}</div>`;
  p.innerHTML = `<div class="sim"><h2 style="font-size:30px;margin:4px 0">Simulation ⚗️</h2><p class="mut">Your real system as a live diagram — plus an editor to design better ones.</p>
  <h3>🏭 Current system (built from uploads)</h3>
  ${cur.hasData ? `<div class="sim-canvas" id="simLive"><svg class="wires" id="wiresLive"></svg>${col('production', '⚙ Production')}${col('storage', '🔋 Storage')}${col('distribution', '🔌 Distribution')}</div>
  <div class="grid g3" style="margin-top:10px"><div class="card"><b>Production</b><p class="mut">${cur.summaries.production}</p></div><div class="card"><b>Storage</b><p class="mut">${cur.summaries.storage}</p></div><div class="card"><b>Distribution</b><p class="mut">${cur.summaries.distribution}</p></div></div>
  ${simScoreHtml(cur.score)}
  <div class="card" style="margin-top:12px"><h3>🤖 AI on your current system</h3>${cur.suggest.tips.map(t => `<p>• ${t}</p>`).join('')}</div>`
  : '<div class="card"><p>No machine / battery / sector uploads yet — upload them first, then the live diagram appears here.</p></div>'}
  <h3 style="margin-top:20px">✏ Workflow editor (design your own)</h3>
  <div class="card"><div class="row">
    <select id="eKind" onchange="simKindChange()"><option value="production">⚙ Production source</option><option value="storage">🔋 Storage battery</option><option value="distribution">🔌 Distribution area</option></select>
    <select id="eTech"></select></div>
    <div class="row"><input id="eName" placeholder="Box name e.g. Rooftop solar 1"><input id="eCap" type="number" placeholder="Capacity kW"><input id="eHours" type="number" placeholder="Hours"><input id="eVal" type="number" placeholder="Energy kW"></div>
    <div class="row"><button class="btn g" onclick="simAddBox()">+ Add box</button></div>
    <p class="mut">Tap a box to pick it up, tap another box to connect an arrow. ✕ deletes.</p></div>
  <div class="sim-canvas" id="simEdit"><svg class="wires" id="wiresEdit"></svg>
    <div class="sim-col"><h3>⚙ Production</h3><div id="ecProd"></div></div>
    <div class="sim-col"><h3>🔋 Storage</h3><div id="ecStor"></div></div>
    <div class="sim-col"><h3>🔌 Distribution</h3><div id="ecDist"></div></div></div>
  <div class="card" style="margin-top:10px"><h3>Arrows</h3><div id="edgeList" class="mut">None yet.</div></div>
  <div id="editScore"></div>
  <div class="card" style="margin-top:12px"><h3>🤖 AI suggests the best workflow</h3><div id="editTips" class="mut">Add boxes to get suggestions.</div></div></div>`;
  simKindChange();
  setTimeout(() => drawWires('simLive', 'wiresLive', cur.edges), 80);
  refreshEditor();
}
function simKindChange() {
  const k = ($('eKind') || {}).value || 'production';
  const techs = (window._SIMTECHS || {})[k] || [];
  if ($('eTech')) $('eTech').innerHTML = techs.map(t => `<option>${t}</option>`).join('');
}
function simAddBox() {
  S.boxes = S.boxes || []; S.edges = S.edges || [];
  const kind = ($('eKind') || {}).value || 'production';
  const val = +($('eVal') || {}).value || 0;
  const n = { id: 'c' + Date.now(), kind, tech: ($('eTech') || {}).value || '', label: ($('eName') || {}).value || (kind + ' ' + (S.boxes.length + 1)), capKW: +($('eCap') || {}).value || 0, hours: +($('eHours') || {}).value || 0 };
  if (kind === 'production') n.producedKW = val; else if (kind === 'storage') n.storedKW = val; else n.needKW = val;
  S.boxes.push(n); refreshEditor();
}
function simTap(id) {
  S.edges = S.edges || [];
  if (!S.sel) { S.sel = id; refreshEditor(); return; }
  if (S.sel === id) { S.sel = null; refreshEditor(); return; }
  if (!S.edges.some(e => e.from === S.sel && e.to === id)) S.edges.push({ from: S.sel, to: id });
  S.sel = null; refreshEditor();
}
function simDel(id) { S.boxes = (S.boxes || []).filter(n => n.id !== id); S.edges = (S.edges || []).filter(e => e.from !== id && e.to !== id); if (S.sel === id) S.sel = null; refreshEditor(); }
function simDelEdge(i) { S.edges.splice(i, 1); refreshEditor(); }
async function refreshEditor() {
  if (!$('ecProd')) return;
  const boxes = S.boxes || [], edges = S.edges || [];
  const col = (kind) => boxes.filter(n => n.kind === kind).map(n =>
    simBox(n, null, 'simTap').replace('__DEL__', `<br><button class="btn r sm" onclick="event.stopPropagation();simDel('${n.id}')">✕</button>`)
  ).join('') || '<p class="mut">—</p>';
  $('ecProd').innerHTML = col('production'); $('ecStor').innerHTML = col('storage'); $('ecDist').innerHTML = col('distribution');
  $('edgeList').innerHTML = edges.length ? edges.map((e, i) => {
    const nm = (id) => (boxes.find(n => n.id === id) || {}).label || id;
    return `<p>${nm(e.from)} → ${nm(e.to)} <button class="btn r sm" onclick="simDelEdge(${i})">✕</button></p>`;
  }).join('') : 'None yet — tap one box, then another, to connect.';
  if (!boxes.length) { $('editScore').innerHTML = ''; $('editTips').textContent = 'Add boxes to get suggestions.'; setTimeout(() => drawWires('simEdit', 'wiresEdit', []), 60); return; }
  try {
    const j = await api('/api/simulation/custom', { method: 'POST', body: JSON.stringify({ nodes: boxes, edges }) });
    $('editScore').innerHTML = simScoreHtml(j.score);
    $('editTips').innerHTML = j.suggest.tips.map(t => `<p>• ${t}</p>`).join('');
  } catch (e) { $('editTips').textContent = '❌ ' + e.message; }
  setTimeout(() => drawWires('simEdit', 'wiresEdit', edges), 60);
}

/* ================= ADMIN: APPROVALS ================= */
async function approvals(p) {
  const [j, live] = await Promise.all([api('/api/decisions'), api('/api/problems?city=' + S.city)]);
  window._D = j.decisions; window._L = live.live; window._M = j.manual; hideLoader();
  const shortWhat = (w) => String(w || '').split('.')[0].slice(0, 90);
  const done = j.decisions.filter(d => d.status !== 'pending');
  const hist = [
    ...done.map(d => ({ kind: 'stored', at: d.decidedAt || d.createdAt, d })),
    ...(j.manual || []).map(m => ({ kind: 'manual', at: m.at, m }))
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  p.innerHTML = `<div class="appr"><h2 style="font-size:30px;margin:4px 0">Approvals ✅</h2><p class="mut">Review each issue, then approve it, reject it, or write your own fix.</p>
  <h3>🔴 Live problems (${live.live.length})</h3>
  ${live.live.slice(0, 12).map(x => `<div class="dec ${x.severity}" onclick="liveDetail('${x.id}')"><b>[${x.source}/${x.stage}] ${shortWhat(x.what)}</b><br><span class="mut">Tap for full detail →</span></div>`).join('') || '<p class="mut">None — all OK. ✅</p>'}
  <h3>📜 Decision history (${hist.length})</h3>
  ${hist.map(h => h.kind === 'stored'
    ? `<div class="dec ${h.d.priority}" onclick="storedDetail('${h.d.id}')"><b>${shortWhat(h.d.title)}</b> <span class="pill ${h.d.status === 'approved' ? 'ok' : 'bad'}">${h.d.status}</span><br><span class="mut">Tap to view →</span></div>`
    : `<div class="dec" onclick="manualDetail('${h.m.id}')"><b>${shortWhat(h.m.title)}</b> <span class="pill info">self-made</span><br><span class="mut">Tap to view →</span></div>`).join('') || '<p class="mut">No decisions yet.</p>'}</div>`;
  if (S.openAlert) { const k = S.openAlert; S.openAlert = null; liveDetail(k); }
}
function manualDetail(id) {
  const m = (window._M || []).find(x => String(x.id) === String(id)); if (!m) return;
  $('modalBody').innerHTML = `<span class="pill info">self-made · ${m.source || ''}/${m.stage || ''}</span><h3>${m.title}</h3><p><b>Plan:</b> ${m.detail || '—'}</p><p><b>AI reply:</b> ${m.aiReply || '—'}</p><p class="mut">By ${m.by} · ${String(m.at).slice(0, 16).replace('T', ' ')}</p><div class="row"><button class="btn g" onclick="closeModal()">Close ✓</button></div>`;
  $('modal').classList.remove('hidden');
}
function liveDetail(id) {
  const pr = window._L.find(x => String(x.id) === String(id)); if (!pr) return;
  window._P = pr;
  $('modalBody').innerHTML = `<span class="pill info">${pr.source}/${pr.stage}</span><h3>${pr.what}</h3><p><b>Why:</b> ${pr.why}</p><p><b>How the AI found it:</b> ${pr.how}</p><p><b>Past:</b> ${pr.past}</p><p><b>AI plan:</b> ${pr.solution}</p><p><b>Aim:</b> ${pr.aim}</p><div class="row"><button class="btn g" onclick="promoteAndDecide('approve')">Approve ✓</button><button class="btn r" onclick="askReject()">Reject ✕</button><button class="btn o" onclick="goDraft()">Make a solution ✍</button></div><div id="decZone"></div>`;
  $('modal').classList.remove('hidden');
}
function storedDetail(id) {
  const d = window._D.find(x => String(x.id) === String(id)); if (!d) return;
  $('modalBody').innerHTML = `<span class="pill info">${d.source || ''}/${d.stage || ''}</span> <span class="pill ${d.status === 'pending' ? 'warn' : d.status === 'approved' ? 'ok' : 'bad'}">${d.status}</span><h3>${d.title}</h3>
  <p><b>What:</b> ${d.what || d.detail || ''}</p>${d.why ? `<p><b>Why:</b> ${d.why}</p>` : ''}${d.how ? `<p><b>How the AI found it:</b> ${d.how}</p>` : ''}${d.past ? `<p><b>Past:</b> ${d.past}</p>` : ''}
  <p><b>AI plan:</b> ${d.solution || d.fix || '—'}</p>${d.aim ? `<p><b>Aim:</b> ${d.aim}</p>` : ''}
  ${d.status === 'pending' ? `<div class="row"><button class="btn g" onclick="storedDecide('${d.id}','approve')">Approve ✓</button><button class="btn r" onclick="storedDecide('${d.id}','reject')">Reject ✕</button></div><input id="rejReason" placeholder="Rejection reason in simple words (required, teaches the AI)">` : `<p class="mut">Decided by ${d.decidedBy || '—'}${d.reason ? ' · ' + d.reason : ''}</p>`}
  <div class="row"><button class="btn o" onclick="S.src='${d.source || 'wind'}';closeModal();go('Energy Tracking')">See source →</button><button class="btn o" onclick="discussStored('${d.id}')">Discuss in AI Desk →</button></div>`;
  $('modal').classList.remove('hidden');
}
function discussStored(id) {
  const d = (window._D || []).find(x => String(x.id) === String(id)); if (!d) return;
  S.draft = { source: d.source || 'wind', stage: d.stage || 'production', what: d.what || d.title, why: d.why || '', how: d.how || '', past: d.past || '', solution: d.solution || d.fix || '', aim: d.aim || '', severity: d.priority, liveKey: d.liveKey };
  closeModal(); go('AI Desk');
}
async function storedDecide(id, action) {
  const body = action === 'reject' ? { reason: ($('rejReason') || {}).value || '' } : {};
  try { await api(`/api/decisions/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) }); closeModal(); render(); }
  catch (e) { alert(e.message); }
}

/* ================= ADMIN: AI DESK ================= */
const SUGGEST = ['How do I check if power is being stolen?', 'My battery health is low — what should I do?', 'Storm is coming — how do I protect the windmills?', 'How can I make more solar power?', 'What numbers must uploaders send every day?', 'How does approving a solution work?'];
function faqChips() { return `<div class="faqs">${SUGGEST.map((q, i) => `<button onclick="askFaq(${i})">${q}</button>`).join('')}</div>`; }
function askFaq(i) { const inp = $('chatIn'); if (inp) { inp.value = SUGGEST[i]; } sendChat(); }
async function aiDesk(p) {
  hideLoader();
  if (S.draft && S.draft.what) {
    // arrived via "Make a solution": problem on top, form + chatbot side by side
    const dr = S.draft;
    p.innerHTML = `<div class="aidesk"><h2 style="font-size:30px;margin:4px 0">AI Desk 🤖 <button class="btn o sm" onclick="S.draft=null;render()">✕ close problem</button></h2>
    <div class="card" style="border-color:#f59e0b"><span class="pill info">${dr.source || ''} / ${dr.stage || ''}</span> <span class="pill warn">writing your own solution</span>
      <h3>${dr.what || ''}</h3>${dr.why ? `<p><b>Why:</b> ${dr.why}</p>` : ''}${dr.solution ? `<p><b>AI suggestion (you may overrule):</b> ${dr.solution}</p>` : ''}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>✍ Your decision</h3>
        <input id="mTitle" placeholder="Solution title in your words" value="">
        <div class="row"><select id="mSrc"><option value="wind">🌬 wind</option><option value="solar">☀ solar</option><option value="hydro">🌊 hydro</option></select>
        <select id="mStage"><option value="forecast">forecast</option><option value="production">production</option><option value="storage">storage</option><option value="distribution">distribution</option></select></div>
        <textarea id="mDetail" rows="4" placeholder="Write your full plan here in simple words — the AI reads and learns it…"></textarea>
        <button class="btn g" onclick="submitDraftManual()">Submit for implementation →</button>
        <p class="mut">Pick the type(s) above, write freely, research on the right if needed.</p></div>
      <div class="card"><h3>💬 Research with AI (it learns from you)</h3><div class="chat" id="chat"></div>${faqChips()}
        <div class="row"><input id="chatIn" placeholder="Ask anything…"><button class="btn" onclick="sendChat()">➤</button></div></div>
    </div></div>`;
    $('mSrc').value = dr.source || 'wind'; $('mStage').value = dr.stage || 'production';
    return;
  }
  // direct visit: chatbot only
  p.innerHTML = `<div class="aidesk"><h2 style="font-size:30px;margin:4px 0">AI Desk 🤖</h2><p class="mut">Ask anything about your plant. To write your own fix, open a problem and tap Make a solution.</p>
  <div class="card"><div class="chat" id="chat" style="min-height:300px"></div>${faqChips()}
    <div class="row"><input id="chatIn" placeholder="Ask: theft check? battery sizing? hostel plan?"><button class="btn" onclick="sendChat()">➤</button></div></div></div>`;
}
async function submitDraftManual() {
  const t = ($('mTitle') || {}).value; if (!t) return alert('Please write a solution title');
  const dr = S.draft || {};
  showLoader('Saving your decision…');
  try {
    await api('/api/decisions/manual', { method: 'POST', body: JSON.stringify({ title: t, detail: ($('mDetail') || {}).value, source: ($('mSrc') || {}).value, stage: ($('mStage') || {}).value, liveKey: dr.liveKey || dr.id }) });
    S.draft = null; hideLoader(); go('Approvals');
  } catch (e) { hideLoader(); alert(e.message); }
}
async function sendChat() {
  const v = ($('chatIn') || {}).value; if (!v) return;
  $('chat').innerHTML += `<div class="bubble me">${v}</div>`; $('chatIn').value = '';
  $('chat').innerHTML += `<div class="bubble" id="thinking">🤖 <i>thinking…</i></div>`;
  $('chat').scrollTop = 99999;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const [j] = await Promise.all([api('/api/chat', { method: 'POST', body: JSON.stringify({ message: v }) }), wait(1200)]);
    const th = $('thinking'); if (th) th.outerHTML = `<div class="bubble">🤖 ${j.reply}</div>`;
  } catch (e) { const th = $('thinking'); if (th) th.outerHTML = `<div class="bubble">❌ ${e.message}</div>`; }
  $('chat').scrollTop = 99999;
}

/* ================= ADMIN: FORECASTS ================= */
async function forecasts(p) {
  const f = await api('/api/forecasts?city=' + S.city); hideLoader();
  const dayN = (ds) => { try { return new Date(ds + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { return ds; } };
  p.innerHTML = `<div class="fcst"><h2 style="font-size:30px;margin:4px 0">Forecasts 🌤</h2><p class="mut">Live weather for 4 cities — past week, today, and the next 7 days.</p>
  <div class="seg">${f.cities.map(c => `<button class="${c.key === S.city ? 'on' : ''}" onclick="S.city='${c.key}';render()">📍 ${c.place}</button>`).join('')}</div>
  ${f.cities.filter(c => c.key === S.city).map(c => `<div class="card"><h3>${c.place} <span class="pill ${c.live ? 'ok' : 'warn'}">Source: ${c.live ? 'Open-Meteo (live)' : 'offline snapshot'}</span></h3>
    <div class="wx-grid"><div class="wx-stat"><span>🌡 Temp now</span><b>${c.tempC}°C</b></div><div class="wx-stat"><span>💨 Wind</span><b>${c.windKph} km/h</b></div><div class="wx-stat"><span>☁ Cloud</span><b>${c.cloudPct}%</b></div><div class="wx-stat"><span>🌧 Rain now</span><b>${c.rainMm} mm</b></div><div class="wx-stat"><span>🌊 River</span><b>${c.riverFlowCumec} cumec</b></div><div class="wx-stat"><span>🔆 Irradiance</span><b>${c.solarIrradiance} W/m²</b></div></div>
    <h3>🕰 Past 7 days (archive)</h3><div class="fc-grid">${(c.past || []).map(x => `<div class="fc"><b>${dayN(x.date)}</b><br>${x.tMax}° / ${x.tMin}°<br>🌧 ${x.rainSum}mm<br>💨 ${x.windMax}km/h</div>`).join('')}</div>
    <h3>🔮 Future 7 days (prediction)</h3><div class="fc-grid">${(c.forecast || []).map(x => `<div class="fc"><b>${dayN(x.date)}</b><br>${x.tMax}° / ${x.tMin}°<br>🌧 ${x.rainSum}mm<br>💨 ${x.windMax}km/h</div>`).join('')}</div></div>`).join('')}
  <div class="card" style="margin-top:14px"><h3>🤖 AI outlook</h3>${f.outlook.map(o => `<p><span class="pill info">${o.horizon}</span> ${o.text}</p>`).join('')}</div></div>`;
}

/* ================= ADMIN: FEEDBACK / COMPLAINTS ================= */
async function feedback(p) {
  const j = await api('/api/feedback'); hideLoader();
  p.innerHTML = `<div class="fb"><h2 style="font-size:30px;margin:4px 0">Feedback 💬</h2><p class="mut">Rate the portal and suggest improvements.</p>
  <div class="grid g2"><div class="card"><h3>Leave feedback</h3><div class="row"><select id="fT"><option value="website">website</option><option value="system">system planning</option><option value="ai">AI model & knowledge</option></select><select id="fR"><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></div>
  <textarea id="fM" rows="3" placeholder="What works, what to improve…"></textarea><button class="btn g" onclick="sendFb()">Submit →</button></div>
  <div class="card"><h3>History (${j.feedbacks.length})</h3>${j.feedbacks.map(f => `<div class="dec"><b>${'★'.repeat(f.rating)} ${f.target}</b><br>${f.message}<br><span class="mut">${f.by} · ${f.at.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="mut">None yet.</p>'}</div></div></div>`;
}
async function sendFb() { const m = ($('fM') || {}).value; if (!m) return alert('Write something'); await api('/api/feedback', { method: 'POST', body: JSON.stringify({ rating: $('fR').value, target: $('fT').value, message: m }) }); render(); }
async function complaints(p) {
  const j = await api('/api/complaints'); hideLoader();
  p.innerHTML = `<div class="fb"><h2 style="font-size:30px;margin:4px 0">Complaints 📢</h2><p class="mut">Report theft, faults or rule-breaking.</p>
  <div class="grid g2"><div class="card"><h3>Raise complaint</h3><div class="row"><select id="cS"><option value="wind">wind</option><option value="solar">solar</option><option value="hydro">hydro</option></select><select id="cG"><option value="forecast">forecast</option><option value="production">production</option><option value="storage">storage</option><option value="distribution">distribution</option></select></div>
  <textarea id="cT" rows="3" placeholder="e.g. Feeder B 2 kW missing tonight — suspected theft, patrol requested"></textarea><button class="btn g" onclick="sendCp()">Submit →</button></div>
  <div class="card"><h3>History (${j.complaints.length})</h3>${j.complaints.map(c => `<div class="dec"><b>[${c.source}/${c.stage}] ${c.status}</b><br>${c.text}<br><span class="mut">${c.by} · ${c.at.slice(0, 16).replace('T', ' ')}</span></div>`).join('') || '<p class="mut">None yet.</p>'}</div></div></div>`;
}
async function sendCp() { const t = ($('cT') || {}).value; if (!t) return alert('Write complaint'); await api('/api/complaints', { method: 'POST', body: JSON.stringify({ source: $('cS').value, stage: $('cG').value, text: t }) }); render(); }

/* ================= UPLOADERS ================= */
async function upDash(p) {
  const s = await api('/api/uploader/stats'); hideLoader();
  const names = { production_uploader: 'Production', storage_uploader: 'Storage', transmission_uploader: 'Transmission' };
  p.innerHTML = `<h2 style="font-size:30px;margin:4px 0">${names[S.user.role]} Dashboard 📋</h2>
  <div class="grid g3"><div class="card"><div class="t mut"><b>⏰ DAILY 18:00 REMINDER</b></div><p>${s.reminder}</p><span class="pill ${s.doneToday ? 'ok' : 'warn'}">${s.doneToday ? 'Done today' : 'Pending today'}</span></div>
  <div class="card kpi"><div class="t">TOTAL UPLOADS</div><div class="n">${s.totalUploads}</div><div class="mut">missed day = inconsistency</div></div>
  <div class="card"><h3>Recent</h3>${s.recent.map(u => `<p class="mut">📄 ${u.orig || u.kind} · ${(u.at || '').slice(0, 10)}</p>`).join('') || '<p class="mut">None.</p>'}<button class="btn" onclick="go('Upload')">Upload now →</button></div></div>`;
}
/* simulator tech lists (same as ml/train_simulator.py dummy techs) — refreshed from server when possible */
const SIM_TECHS_FALLBACK = {
  production: ['Wind-DirectDrive 4MW', 'Wind-Geared 2MW', 'Solar-TOPCon 580W', 'Solar-PERC 450W', 'Hydro-Kaplan', 'Hydro-Francis'],
  storage: ['Li-ion LFP', 'Li-ion NMC', 'Solid-State pilot', 'Lead-Acid', 'Flow-Vanadium'],
  distribution: ['HV-132kV line', 'HV-220kV line', 'HVDC link', 'LV-11kV line']
};
async function simTechs() {
  try { const j = await api('/api/simulation/techs'); if (j.techs) return j.techs; } catch {}
  return SIM_TECHS_FALLBACK;
}
async function upUploadTech(p, r) {
  showLoader('Loading tech lists…');
  const techs = await simTechs();
  window._ProdTechs = techs.production || SIM_TECHS_FALLBACK.production;
  window._StorTechs = techs.storage || SIM_TECHS_FALLBACK.storage;
  hideLoader();
  let form = '';
  if (r === 'production_uploader') form = `<h3>Production upload (daily)</h3><input id="dProd" type="number" placeholder="Produced energy in kW (total)"><input id="dHrs" type="number" placeholder="Operation time in hours"><input id="dSolar" type="number" placeholder="Solar produced energy in kW"><input id="dWind" type="number" placeholder="Wind produced energy in kW"><input id="dHydro" type="number" placeholder="Hydro produced energy in kW"><h3 style="margin-top:10px">Machines</h3><div id="machBox"></div><div class="row"><button class="btn o sm" onclick="addMachine('wind')">+ Add Windmill</button><button class="btn o sm" onclick="addMachine('solar')">+ Add Solar</button><button class="btn o sm" onclick="addMachine('hydro')">+ Add Hydro</button></div><textarea id="dNotes" rows="2" placeholder="Any additional notes…" style="margin-top:10px"></textarea><button class="btn g" onclick="sendDaily('production')">Upload production →</button>`;
  if (r === 'storage_uploader') form = `<h3>Storage upload (total, daily)</h3><input id="dStored" type="number" placeholder="Total stored kW e.g. 15"><input id="dEmer" type="number" placeholder="Emergency savings kW e.g. 6"><input id="dRecv" type="number" placeholder="Total received kW e.g. 21"><input id="dSent" type="number" placeholder="Total sent out kW e.g. 15"><h3 style="margin-top:10px">Batteries</h3><div id="battBox"></div><button class="btn o sm" onclick="addBattery()">+ Add battery section</button><textarea id="dNotes" rows="2" placeholder="Any additional notes…" style="margin-top:10px"></textarea><button class="btn g" onclick="sendDaily('storage')">Upload storage →</button>`;
  p.innerHTML = `<h2 style="font-size:30px;margin:4px 0">Upload 📤 <span class="pill info">${S.user.role.replace(/_/g, ' ')}</span></h2><div class="grid g2"><div class="card">${form}<p id="dMsg" class="mut"></p></div><div class="card"><h3>History</h3><div id="dHist2" class="mut">Loading…</div></div></div>`;
  loadDaily();
}
function upUpload(p) {
  hideLoader();
  const r = S.user.role;
  if (r === 'production_uploader' || r === 'storage_uploader') return upUploadTech(p, r);
  let form = '';
  if (r === 'transmission_uploader') form = `<h3>Transmission upload (total, daily)</h3><input id="dRecvE" type="number" placeholder="Total Received Energy in kW"><input id="dDistE" type="number" placeholder="Total Distributed Energy in kW (consumption)"><input id="dResE" type="number" placeholder="Reserved Energy in kW"><input id="dShortE" type="number" placeholder="Shortage if any in kW"><input id="dExcE" type="number" placeholder="Excess if any in kW"><h3 style="margin-top:10px">Distribution sectors</h3><div id="secBox"></div><button class="btn o sm" onclick="addSector()">+ Add distribution section</button><textarea id="dNotes" rows="2" placeholder="Any additional notes…" style="margin-top:10px"></textarea><button class="btn g" onclick="sendDaily('transmission')">Upload transmission →</button><p class="mut">Sent vs received is auto-checked (±7%).</p>`;
  if (r === 'admin') form = `<p class="mut">Admin file area (PDF/Word/Excel):</p><input type="file" id="upFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"><button class="btn" onclick="sendFile()">Upload file →</button><p id="upMsg" class="mut"></p>`;
  p.innerHTML = `<h2 style="font-size:30px;margin:4px 0">Upload 📤 <span class="pill info">${S.user.role.replace(/_/g, ' ')}</span></h2><div class="grid g2"><div class="card">${form}<p id="dMsg" class="mut"></p></div><div class="card"><h3>History</h3><div id="dHist2" class="mut">Loading…</div></div></div>`;
  loadDaily();
}
function addSector(name, kw) {
  const box = $('secBox'); if (!box) return;
  const div = document.createElement('div'); div.className = 'row sec-row';
  div.innerHTML = `<input placeholder="Distribution name e.g. Hostel block A" value="${(name || '').replace(/"/g, '&quot;')}" style="flex:2"><input type="number" placeholder="kW" value="${kw || ''}" style="flex:1"><button class="btn r sm" onclick="this.parentElement.remove()">✕</button>`;
  box.appendChild(div);
}
function getSectors() {
  return [...document.querySelectorAll('#secBox .sec-row')].map(r => {
    const ins = r.querySelectorAll('input');
    return { name: ins[0].value, kw: +ins[1].value || 0 };
  }).filter(s => s.name || s.kw);
}
function addMachine(type) {
  const box = $('machBox'); if (!box) return;
  const label = { wind: 'Windmill', solar: 'Solar unit', hydro: 'Hydro turbine' }[type] || type;
  const all = window._ProdTechs || SIM_TECHS_FALLBACK.production;
  const opts = all.filter(t => t.toLowerCase().startsWith(type));
  const list = opts.length ? opts : all;
  const div = document.createElement('div'); div.className = 'card batt-row';
  div.innerHTML = `<span class="pill info">${label}</span><input placeholder="${label} name e.g. ${label}-1"><select>${list.map(t => `<option>${t}</option>`).join('')}</select><div class="row"><input type="number" placeholder="Capacity in 1h (kW)"><input type="number" placeholder="Operation time (hours)"></div><input type="number" placeholder="Produced energy (kW)"><button class="btn r sm" onclick="this.parentElement.remove()">✕ Remove</button>`;
  div.dataset.type = type;
  box.appendChild(div);
}
function getMachines() {
  return [...document.querySelectorAll('#machBox .batt-row')].map(r => {
    const ins = r.querySelectorAll('input'), sel = r.querySelector('select');
    return { type: r.dataset.type, name: ins[0].value, tech: sel ? sel.value : '', capKW: +ins[1].value || 0, hours: +ins[2].value || 0, producedKW: +ins[3].value || 0 };
  }).filter(m => m.name || m.producedKW);
}
function addBattery(b) {
  const box = $('battBox'); if (!box) return;
  b = b || {};
  const q = (v) => String(v || '').replace(/"/g, '&quot;');
  const techs = window._StorTechs || SIM_TECHS_FALLBACK.storage;
  const div = document.createElement('div'); div.className = 'card batt-row';
  div.innerHTML = `<input placeholder="Battery name e.g. Block-A unit 1" value="${q(b.name)}"><select>${techs.map(t => `<option${t === b.tech ? ' selected' : ''}>${t}</option>`).join('')}</select><div class="row"><input type="number" placeholder="Capacity kW" value="${b.cap || ''}"><input type="number" placeholder="Stored kW" value="${b.stored || ''}"></div><div class="row"><input type="number" placeholder="No of charges" value="${b.charges || ''}"><input type="number" placeholder="No of discharges" value="${b.discharges || ''}"></div><button class="btn r sm" onclick="this.parentElement.remove()">✕ Remove</button>`;
  box.appendChild(div);
}
function getBatteries() {
  return [...document.querySelectorAll('#battBox .batt-row')].map(r => {
    const ins = r.querySelectorAll('input'), sel = r.querySelector('select');
    return { name: ins[0].value, tech: sel ? sel.value : '', cap: +ins[1].value || 0, stored: +ins[2].value || 0, charges: +ins[3].value || 0, discharges: +ins[4].value || 0 };
  }).filter(b => b.name || b.cap || b.stored);
}
async function loadDaily() {
  const map = { production_uploader: 'production', storage_uploader: 'storage', transmission_uploader: 'transmission' };
  const k = map[S.user.role]; if (!k) return;
  try {
    const j = await api('/api/daily/' + k);
    $('dHist2').innerHTML = j.recs.slice(0, 8).map(x => {
      const secs = (x.data && x.data.sectors || []).map(s => `${s.name}: ${s.kw}kW`).join(' · ');
      const batts = (x.data && x.data.batteries || []).map(b => `${b.name || 'battery'} (${b.tech || '?'}) ${b.stored}/${b.cap}kW ⚡${b.charges}⇅${b.discharges}`).join(' · ');
      const machs = (x.data && x.data.machines || []).map(m => `${m.type}:${m.name || '?'} ${m.producedKW}kW/${m.hours}h`).join(' · ');
      const extra = [secs, batts, machs].filter(Boolean).join(' · ');
      return `<p>📄 ${x.at.slice(0, 16).replace('T', ' ')} · ${JSON.stringify(x.data).slice(0, 110)}${extra ? `<br>↳ ${extra}` : ''}</p>`;
    }).join('') || 'No uploads yet.';
  }
  catch { $('dHist2').textContent = 'Login again.'; }
}
async function sendDaily(kind) {
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  let body = {};
  if (kind === 'production') body = { producedKW: +g('dProd'), hours: +g('dHrs'), solarKW: +g('dSolar'), windKW: +g('dWind'), hydroKW: +g('dHydro'), machines: getMachines(), notes: g('dNotes') };
  if (kind === 'storage') body = { storedKW: +g('dStored'), emergencyKW: +g('dEmer'), receivedKW: +g('dRecv'), sentKW: +g('dSent'), batteries: getBatteries(), notes: g('dNotes') };
  if (kind === 'transmission') body = { totalReceivedKW: +g('dRecvE'), totalDistributedKW: +g('dDistE'), reservedKW: +g('dResE'), shortageKW: +g('dShortE'), excessKW: +g('dExcE'), sectors: getSectors(), notes: g('dNotes') };
  try { const j = await api('/api/daily/' + kind, { method: 'POST', body: JSON.stringify(body) }); $('dMsg').textContent = `✅ Saved. Roadmap: wind ${j.rec.roadmap.wind.verdict} · solar ${j.rec.roadmap.solar.verdict} · hydro ${j.rec.roadmap.hydro.verdict}`; loadDaily(); }
  catch (e) { $('dMsg').textContent = '❌ ' + e.message; }
}
async function sendFile() {
  const f = $('upFile').files[0]; if (!f) return alert('Choose PDF/Word/Excel');
  const fd = new FormData(); fd.append('file', f); fd.append('kind', 'general');
  const r = await fetch('/api/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token }, body: fd });
  const j = await r.json(); $('upMsg').textContent = r.ok ? '✅ ' + (j.upload.parsed.aiNote || 'indexed') : '❌ ' + j.error;
}

paintTip();
paintFaq();
loadStats();
boot();
