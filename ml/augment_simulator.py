"""Append REAL upload measurements to the simulator dataset, retrain, and test.
Derives true efficiency rows from production machine uploads:
  efficiency = produced / (capacity * hours) * 100
Then retrains (ml/train_simulator.py preserves src='upload' rows) and reports
R2 + MAE of the model on the real upload rows.
Run: python ml/augment_simulator.py   (server NOT required; reads data/db.json)
"""
import csv, json, os, subprocess, sys

BASE = os.path.dirname(__file__)
DB = os.path.join(BASE, '..', 'data', 'db.json')
DS = os.path.join(BASE, 'dataset_simulator.csv')

db = json.load(open(DB, encoding='utf-8'))
new_rows = []
for rec in db.get('daily', {}).get('production', []):
    for m in (rec.get('data') or {}).get('machines', []):
        try:
            cap, hrs, prod = float(m['capKW']), float(m['hours']), float(m['producedKW'])
        except (KeyError, TypeError, ValueError):
            continue
        if cap <= 0 or hrs <= 0:
            continue
        eff = max(40.0, min(99.0, prod / (cap * hrs) * 100))
        new_rows.append(['production', m.get('tech', 'unknown'), cap, hrs, 30.0, 65.0, round(eff, 2), 'upload'])

# dedupe against existing upload rows, then append
existing = set()
if os.path.exists(DS):
    with open(DS) as f:
        for r in csv.DictReader(f):
            if r.get('src') == 'upload':
                existing.update([(r['kind'], r['tech'], r['capacityKW'], r['hours'], r['efficiencyPct'])])
fresh = [r for r in new_rows if (r[0], r[1], str(r[2]), str(r[3]), str(r[6])) not in existing]
with open(DS, 'a', newline='') as f:
    csv.writer(f).writerows(fresh)
print(f'upload rows: {len(new_rows)} derived, {len(fresh)} new appended')

# retrain (preserves upload rows)
r = subprocess.run([sys.executable, os.path.join(BASE, 'train_simulator.py')], capture_output=True, text=True)
print(r.stdout.strip())
if r.returncode != 0:
    print(r.stderr[-2000:]); sys.exit(1)

# test: MAE of trained model on the REAL upload rows
sys.path.insert(0, os.path.dirname(BASE))
model = json.load(open(os.path.join(BASE, 'models', 'simulator.json')))
regs = model.get('regressions', {})
errs, n = 0.0, 0
for r in new_rows:
    kind, tech, cap, hrs, temp, load, actual = r[0], r[1], r[2], r[3], r[4], r[5], r[6]
    reg = regs.get(kind)
    if not reg or tech not in reg['techs']:
        continue
    feats = [cap, hrs, temp, load] + [1 if t == tech else 0 for t in reg['techs']]
    pred = reg['intercept'] + sum(c * x for c, x in zip(reg['coef'], feats))
    errs += abs(pred - actual); n += 1
print(f'TEST on real uploads: n={n}, MAE={errs / n:.2f} efficiency points' if n else 'no matching rows to test')
print('metrics:', json.load(open(os.path.join(BASE, 'models', 'simulator.json')))['regressions']['production']['r2'] if regs else None)
