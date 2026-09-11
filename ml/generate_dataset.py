"""Generate a MEDIUM-SIZE synthetic-but-realistic dataset (~1200 rows) for renewable ops.
Features mirror the website's daily uploader fields + weather + equipment + battery.
Labels: problem_class + severity + solution_id (used to train the 3 models).
Run: python ml/generate_dataset.py
"""
import csv, random, os

random.seed(2026)
OUT = os.path.join(os.path.dirname(__file__), 'dataset_problem.csv')

SOURCES = ['solar', 'wind', 'hydro']
STAGES = ['forecast', 'production', 'storage', 'distribution']

SOLUTIONS = {
    0: 'No action — continue routine monitoring.',
    1: 'Schedule preventive maintenance within 7 days (oiling/greasing, alignment, cleaning).',
    2: 'Emergency overhaul: stop unit, replace bearings / deep-clean + PID test.',
    3: 'Rebalance battery: revise charge setpoint, cell balancing + thermal check.',
    4: 'Replace battery strings; top up emergency reserve to 15%.',
    5: 'Raise transmission to HV 132-220kV, inspect joints, patrol feeder.',
    6: 'Theft protocol: SCADA-vs-meter audit, night patrol, file complaint with distributor.',
    7: 'Weather protection: feather turbines / tilt-drain panels / controlled dam release.',
    8: 'Demand uploader explanation; freeze settlement until data reconciled.',
    9: 'Trim generation setpoint 5%; shift surplus to emergency reserve.',
}

rows = []
N = 1200
for i in range(N):
    source = random.choice(SOURCES)
    stage = random.choice(STAGES)
    # weather realistic per India
    tempC = round(random.uniform(18, 42), 1)
    windKph = round(random.uniform(2, 110), 1)
    cloudPct = random.randint(0, 100)
    rainMm = round(max(0, random.gauss(3, 8)), 1)
    riverFlow = random.randint(30, 260)
    # equipment
    eff = round(random.uniform(60, 99), 1)
    vib = round(random.uniform(0, 8), 1)
    age = random.randint(1, 20)
    service = random.randint(5, 400)
    # battery
    health = random.randint(55, 100)
    soc = round(random.uniform(5, 100), 1)
    emerPct = round(random.uniform(2, 25), 1)
    # distribution
    txLoss = round(random.uniform(1, 14), 2)
    devPct = round(abs(random.gauss(4, 7)), 2)  # calc-vs-actual deviation
    produced = round(random.uniform(1.5, 5.0), 2)
    stored = round(produced * random.uniform(0.85, 1.0), 2)

    # ---- labeling logic (the "ground truth" physics) ----
    if devPct > 20 or (devPct > 12 and random.random() < 0.7):
        pc, sev, sol = 5, 'critical', 8          # data fault
    elif stage == 'distribution' and (txLoss > 8 or devPct > 12):
        pc, sev, sol = (3, 'critical', 6) if devPct > 12 else (3, 'medium', 5)
    elif stage == 'storage' and (health < 75 or emerPct < 10):
        pc, sev, sol = 2, 'critical', 4
    elif stage == 'storage' and (health < 85 or soc > 95 or abs(stored - 3.2) > 1.2):
        pc, sev, sol = 2, 'medium', 3
    elif stage == 'production' and (eff < 78 or vib > 4.5 or age > 15):
        pc, sev, sol = 1, 'critical', 2
    elif stage == 'production' and (eff < 86 or service > 180):
        pc, sev, sol = 1, 'medium', 1
    elif stage == 'forecast' and (windKph > 90 or (source == 'solar' and rainMm > 2) or rainMm > 20 or windKph < 12 or cloudPct > 60):
        pc, sev, sol = 4, ('critical' if (windKph > 90 or rainMm > 20) else 'medium'), 7
    elif devPct > 7:
        pc, sev, sol = (5, 'medium', 9) if stage == 'storage' else (0, 'low', 9)
        if devPct <= 7:
            pc, sev, sol = 0, 'low', 0
    else:
        pc, sev, sol = 0, 'low', 0

    # add ~8% label noise so the model must actually learn
    if random.random() < 0.08:
        pc = random.randint(0, 5); sol = random.choice(list(SOLUTIONS.keys()))

    rows.append([i, source, stage, tempC, windKph, cloudPct, rainMm, riverFlow,
                 eff, vib, age, service, health, soc, emerPct, txLoss, devPct,
                 produced, stored, pc, sev, sol])

with open(OUT, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'source', 'stage', 'tempC', 'windKph', 'cloudPct', 'rainMm', 'riverFlowCumec',
                'efficiencyPct', 'vibration', 'ageYears', 'lastServiceDays',
                'batteryHealth', 'socPct', 'emergencyPct', 'txLossPct', 'devPct',
                'producedKW', 'storedKW', 'problem_class', 'severity', 'solution_id'])
    w.writerows(rows)

print(f'Wrote {len(rows)} rows -> {OUT}')
print('problem_class distribution:')
from collections import Counter
print(Counter(r[-3] for r in rows))
