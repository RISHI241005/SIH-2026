// Tiny JSON-file DB. Roles per plan: admin + 4 uploaders. Scale: large/small per user.
const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const VALID_ROLES = ['admin', 'production_uploader', 'storage_uploader', 'transmission_uploader'];
const VALID_SCALES = ['large', 'small'];

function defaultDB() {
  const day = (i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); };
  const hist = [];
  for (let i = 29; i >= 0; i--) {
    hist.push({
      date: day(i),
      wind: +(2.4 + Math.sin(i / 4) * 0.5 + Math.random() * 0.4).toFixed(2),
      solar: +(3.0 + Math.cos(i / 5) * 0.6 + Math.random() * 0.3).toFixed(2),
      hydro: +(3.6 + Math.sin(i / 6) * 0.4 + Math.random() * 0.3).toFixed(2),
      usage: +(8.2 + Math.random() * 1.4).toFixed(2)
    });
  }
  return {
    users: [
      { id: 'u-admin', name: 'Admin', email: 'admin@renew.io', pass: '__RESET_ON_BOOT__', role: 'admin', scale: 'small', org: 'Adamas University (demo hostel)' }
    ],
    uploads: [],
    // daily numeric uploads per plan: weather / production / storage / transmission
    daily: { weather: [], production: [], storage: [], transmission: [] },
    decisions: [
      { id: 1, source: 'solar', stage: 'storage', title: 'Battery tuning on solar', what: 'Surplus 0.8 MWh stored over demand.', why: 'Generation setpoint higher than hostel consumption curve.', how: 'Charge controller held absorption too long; detected by storage-vs-demand gap.', past: 'Solved 12 days ago by trimming setpoint 5% — worked, no recurrence for 9 days.', detail: 'Surplus 0.8 MWh over demand — trim generation setpoint to cut holding cost.', solution: 'Approve revised charge setpoint & capacity plan.', aim: 'Cut holding cost, keep SoC 20-90%, protect emergency reserve.', priority: 'medium', fix: 'Approve revised charge setpoint & capacity plan.', status: 'pending', createdAt: new Date().toISOString() },
      { id: 2, source: 'hydro', stage: 'distribution', title: 'Distribution alert: hydro', what: 'City Station B 9.4% deficit beyond tolerance.', why: 'Feeder meter lower than SCADA dispatch; possible tapping or joint loss.', how: 'SCADA-vs-meter comparison flagged the gap tonight.', past: 'Similar event last month: patrol found illegal tapping; fined & fixed.', detail: 'City Station B: 9.4% deficit beyond 7% tolerance. Investigate.', solution: 'Approve feeder patrol + HV correction.', aim: 'Recover lost units, confirm HV protocol, stop theft.', priority: 'medium', fix: 'Approve feeder patrol + HV correction.', status: 'pending', createdAt: new Date().toISOString() },
      { id: 3, source: 'wind', stage: 'production', title: 'Maintenance: wind unit needs attention', what: 'Turbine efficiency 81% and drifting.', why: 'Bearing wear + 210 days since service.', how: 'Vibration + efficiency trend crossed ML thresholds.', past: 'Greasing cycle 3 months ago restored +4% efficiency.', detail: 'Efficiency 81% drifting. Schedule oiling/greasing + alignment within 7 days.', solution: 'Approve greasing/oiling shutdown 4 hrs; order bearings.', aim: 'Restore efficiency above 86%, avoid gearbox damage.', priority: 'medium', fix: 'Approve greasing/oiling shutdown 4 hrs; order bearings.', status: 'pending', createdAt: new Date().toISOString() }
    ],
    manualDecisions: [],
    resolvedLive: [],   // liveKeys the admin already approved / rejected / solved -> hidden, health recovers
    feedbacks: [],
    complaints: [],
    readings: {
      wind: { calc: { produced: 3.2, stored: 3.2, transmitted: 3.0, houses: 1.0, industry: 1.5, others: 0.5 }, actual: { produced: 2.9, stored: 2.9, transmitted: 2.83, houses: 1.0, industry: 1.5, others: 0.33 } },
      solar: { calc: { produced: 3.4, stored: 3.4, transmitted: 3.15, houses: 1.1, industry: 1.5, others: 0.55 }, actual: { produced: 3.1, stored: 3.05, transmitted: 2.9, houses: 1.05, industry: 1.45, others: 0.4 } },
      hydro: { calc: { produced: 4.0, stored: 4.0, transmitted: 3.7, houses: 1.2, industry: 1.8, others: 0.7 }, actual: { produced: 3.9, stored: 3.9, transmitted: 3.62, houses: 1.2, industry: 1.78, others: 0.64 } }
    },
    equipment: {
      wind: { type: 'turbine', ageYears: 9, efficiencyPct: 81, vibration: 3.2, lastServiceDays: 210 },
      solar: { type: 'panel', ageYears: 6, efficiencyPct: 88, vibration: 0.2, lastServiceDays: 90 },
      hydro: { type: 'turbine', ageYears: 12, efficiencyPct: 84, vibration: 4.9, lastServiceDays: 160 }
    },
    batteries: {
      wind: { capacityMWh: 5.0, storedMWh: 3.1, healthPct: 87, cycles: 2100, emergencyReserveMWh: 0.8, demandMWh: 3.0 },
      solar: { capacityMWh: 5.5, storedMWh: 4.4, healthPct: 82, cycles: 3100, emergencyReserveMWh: 0.5, demandMWh: 3.2 },
      hydro: { capacityMWh: 6.0, storedMWh: 4.0, healthPct: 91, cycles: 1500, emergencyReserveMWh: 1.0, demandMWh: 3.7 }
    },
    stations: {
      wind: [
        { name: 'City Station A', expectedMWh: 1.2, actualMWh: 1.15, protocolOk: true, detail: '' },
        { name: 'City Station B', expectedMWh: 1.1, actualMWh: 0.92, protocolOk: false, detail: 'HV step-down skipped (11kV instead of 33kV)' },
        { name: 'Industrial Feeder', expectedMWh: 0.7, actualMWh: 0.68, protocolOk: true, detail: '' }
      ],
      solar: [
        { name: 'City Station A', expectedMWh: 1.3, actualMWh: 1.25, protocolOk: true, detail: '' },
        { name: 'City Station C', expectedMWh: 1.0, actualMWh: 0.97, protocolOk: true, detail: '' },
        { name: 'Industrial Feeder', expectedMWh: 0.85, actualMWh: 0.68, protocolOk: true, detail: '' }
      ],
      hydro: [
        { name: 'City Station A', expectedMWh: 1.5, actualMWh: 1.47, protocolOk: true, detail: '' },
        { name: 'City Station B', expectedMWh: 1.3, actualMWh: 1.18, protocolOk: true, detail: '' },
        { name: 'Industrial Feeder', expectedMWh: 0.9, actualMWh: 0.88, protocolOk: true, detail: '' }
      ]
    },
    history: hist,
    seq: { decision: 10, upload: 1, feedback: 1, complaint: 1 }
  };
}

function load() {
  try {
    if (!fs.existsSync(DB_FILE)) { const d = defaultDB(); save(d); return d; }
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // migrate older DBs
    if (!db.daily) db.daily = { weather: [], production: [], storage: [], transmission: [] };
    if (!db.feedbacks) db.feedbacks = [];
    if (!db.complaints) db.complaints = [];
    if (!db.manualDecisions) db.manualDecisions = [];
    if (!db.resolvedLive) db.resolvedLive = [];
    if (!db.seq.feedback) db.seq.feedback = 1;
    if (!db.seq.complaint) db.seq.complaint = 1;
    return db;
  } catch { const d = defaultDB(); try { save(d); } catch {} return d; }
}
function save(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
module.exports = { load, save, VALID_ROLES, VALID_SCALES };
