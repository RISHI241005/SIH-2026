// Weather provider: Open-Meteo (keyless, no API key needed)
// 4 cities EXACTLY per plan: Kolkata, Delhi, Mumbai, Hyderabad
// Each city returns: past (7 days archive) + present (current) + future (7-day forecast)
const CITIES = {
  kolkata:   { label: 'Kolkata',   lat: 22.57, lon: 88.36 },
  delhi:     { label: 'Delhi',     lat: 28.61, lon: 77.23 },
  mumbai:    { label: 'Mumbai',    lat: 19.07, lon: 72.87 },
  hyderabad: { label: 'Hyderabad', lat: 17.38, lon: 78.48 }
};

function synth(key) {
  const c = CITIES[key];
  const base = { kolkata: [32, 18, 40], delhi: [31, 22, 18], mumbai: [30, 25, 35], hyderabad: [33, 20, 25] }[key] || [30, 20, 25];
  const today = new Date();
  const dstr = (off) => { const d = new Date(today); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
  const past = [], forecast = [];
  for (let i = -7; i < 0; i++) past.push({ date: dstr(i), tMax: base[0] - 1 + Math.random() * 2, tMin: base[0] - 8, rainSum: +(Math.random() * 4).toFixed(1), windMax: base[1] + Math.round(Math.random() * 6) });
  for (let i = 0; i < 7; i++) forecast.push({ date: dstr(i), tMax: +(base[0] + Math.random() * 2).toFixed(1), tMin: base[0] - 7, rainSum: +(Math.random() * 3).toFixed(1), windMax: base[1] + Math.round(Math.random() * 5) });
  return {
    key, place: c.label, live: false,
    tempC: base[0], windKph: base[1], cloudPct: base[2], humidityPct: 60,
    rainMm: 0, riverFlowCumec: 110 + Math.round(Math.random() * 30),
    solarIrradiance: Math.max(80, Math.round(950 - base[2] * 6)),
    summary: `${c.label} (offline snapshot): ${base[0]}°C, wind ${base[1]} km/h, cloud ${base[2]}%`,
    updatedAt: new Date().toISOString(), past, forecast,
    impact: impactText(base[0], base[1], base[2], 0)
  };
}

function impactText(temp, wind, cloud, rain) {
  const t = [];
  if (wind >= 12 && wind <= 90) t.push('Wind: good for windmills');
  else if (wind < 12) t.push('Wind: low — windmill output will dip');
  else t.push('Wind: storm — shut down turbines');
  if (cloud < 20 && rain === 0) t.push('Solar: peak generation');
  else if (rain > 2) t.push('Solar: rain risk — protect panels');
  else t.push('Solar: partial cloud — expect 15-30% dip');
  if (rain > 20) t.push('Hydro: heavy inflow — release via turbines');
  else t.push('Hydro: normal dam operation');
  return t.join(' · ');
}

async function fetchWithTimeout(url, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(t); return r; }
  catch (e) { clearTimeout(t); throw e; }
}

async function fetchCity(key) {
  const c = CITIES[key];
  if (!c) key = 'kolkata';
  const cc = CITIES[key];
  try {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startD = new Date(today); startD.setDate(startD.getDate() - 7);
    const start = startD.toISOString().slice(0, 10);
    const liveUrl = `https://api.open-meteo.com/v1/forecast?latitude=${cc.lat}&longitude=${cc.lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;
    const pastUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${cc.lat}&longitude=${cc.lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;
    const [rl, rp] = await Promise.all([fetchWithTimeout(liveUrl), fetchWithTimeout(pastUrl)]);
    if (!rl.ok) return synth(key);
    const j = await rl.json();
    const cur = j.current || {}, daily = j.daily || {};
    const forecast = (daily.time || []).map((d, i) => ({
      date: d, tMax: daily.temperature_2m_max?.[i], tMin: daily.temperature_2m_min?.[i],
      rainSum: daily.precipitation_sum?.[i], windMax: daily.wind_speed_10m_max?.[i]
    }));
    let past = [];
    try {
      if (rp.ok) {
        const pj = await rp.json();
        const pd = pj.daily || {};
        past = (pd.time || []).map((d, i) => ({
          date: d, tMax: pd.temperature_2m_max?.[i], tMin: pd.temperature_2m_min?.[i],
          rainSum: pd.precipitation_sum?.[i], windMax: pd.wind_speed_10m_max?.[i]
        }));
      }
    } catch { /* past optional */ }
    const tempC = cur.temperature_2m ?? 30, windKph = cur.wind_speed_10m ?? 18,
      cloudPct = cur.cloud_cover ?? 25, rainMm = cur.precipitation ?? 0;
    return {
      key, place: cc.label, live: true, tempC, windKph, cloudPct,
      humidityPct: cur.relative_humidity_2m ?? 60, rainMm,
      riverFlowCumec: 90 + Math.round(rainMm * 8 + Math.random() * 40),
      solarIrradiance: Math.max(80, Math.round(950 - cloudPct * 6)),
      summary: `${cc.label}: ${tempC}°C, wind ${windKph} km/h, cloud ${cloudPct}%, rain ${rainMm}mm`,
      updatedAt: new Date().toISOString(), past, forecast,
      impact: impactText(tempC, windKph, cloudPct, rainMm)
    };
  } catch { return synth(key); }
}

// Backward-compatible: default-city shaped object + .cities + .city
async function fetchWeather(defaultKey = 'kolkata') {
  const keys = Object.keys(CITIES);
  const cities = await Promise.all(keys.map(fetchCity));
  const sel = cities.find(c => c.key === defaultKey) || cities[0];
  return {
    ...sel, cities,
    city: Object.fromEntries(cities.map(c => [c.key, c])),
    historyNote: 'Past = Open-Meteo archive (7 days). Present = live current. Future = 7-day forecast. 30-day ops pattern in Analytics history.'
  };
}

module.exports = { fetchWeather, fetchCity, CITIES };
