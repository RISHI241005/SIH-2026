"""Simulator model: trained on a dummy dataset of machine/battery tech options.
Dataset: 900 rows (tech, kind, capacityKW, hours, tempC, loadPct -> efficiencyPct).
Model: LinearRegression efficiency ~ features + tech one-hot, per kind.
Exports ml/models/simulator.json (coefficients + tech table + R2) for the Node backend.
Run: python ml/train_simulator.py   (needs scikit-learn; falls back to averages)
"""
import csv, json, math, os, random

random.seed(77)
BASE = os.path.dirname(__file__)
DS = os.path.join(BASE, 'dataset_simulator.csv')
OUT = os.path.join(BASE, 'models', 'simulator.json')
os.makedirs(os.path.join(BASE, 'models'), exist_ok=True)

TECHS = {
    'production': ['Wind-DirectDrive 4MW', 'Wind-Geared 2MW', 'Solar-TOPCon 580W', 'Solar-PERC 450W', 'Hydro-Kaplan', 'Hydro-Francis'],
    'storage': ['Li-ion LFP', 'Li-ion NMC', 'Solid-State pilot', 'Lead-Acid', 'Flow-Vanadium'],
    'distribution': ['HV-132kV line', 'HV-220kV line', 'HVDC link', 'LV-11kV line'],
}
BASE_EFF = {'Wind-DirectDrive 4MW': 93, 'Wind-Geared 2MW': 86, 'Solar-TOPCon 580W': 91, 'Solar-PERC 450W': 83,
            'Hydro-Kaplan': 90, 'Hydro-Francis': 85, 'Li-ion LFP': 92, 'Li-ion NMC': 89, 'Solid-State pilot': 95,
            'Lead-Acid': 74, 'Flow-Vanadium': 78, 'HV-132kV line': 94, 'HV-220kV line': 96, 'HVDC link': 97, 'LV-11kV line': 84}

rows = []
for i in range(900):
    kind = random.choice(list(TECHS.keys()))
    tech = random.choice(TECHS[kind])
    cap = round(random.uniform(1, 500), 1)
    hours = round(random.uniform(1, 20), 1)
    temp = round(random.uniform(15, 45), 1)
    load = round(random.uniform(20, 100), 1)
    eff = BASE_EFF[tech] - 0.06 * abs(temp - 28) - 0.02 * max(0, load - 80) + random.gauss(0, 1.5)
    eff = round(max(50, min(99, eff)), 2)
    rows.append([kind, tech, cap, hours, temp, load, eff])

# keep real upload rows from previous augment runs (src == 'upload')
keep = []
if os.path.exists(DS):
    try:
        with open(DS) as f:
            rd = list(csv.DictReader(f))
        for r in rd:
            if r.get('src') == 'upload':
                keep.append([r['kind'], r['tech'], float(r['capacityKW']), float(r['hours']),
                             float(r['tempC']), float(r['loadPct']), float(r['efficiencyPct']), 'upload'])
    except Exception as e:
        print('could not read old dataset:', e)
seen = set()
rows = [r for r in rows if not (tuple(r) in seen or seen.add(tuple(r)))]
all_rows = rows + [k for k in keep if tuple(k) not in seen]

with open(DS, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['kind', 'tech', 'capacityKW', 'hours', 'tempC', 'loadPct', 'efficiencyPct', 'src'])
    w.writerows([r + ['synth'] for r in rows] + keep)
rows = all_rows

# train: per-kind linear regression on [capacity, hours, temp, load] + tech one-hot
model = {'techs': TECHS, 'n_rows': len(rows), 'dataset': 'ml/dataset_simulator.csv'}
try:
    from sklearn.linear_model import LinearRegression
    kinds = {}
    for kind in TECHS:
        rk = [r for r in rows if r[0] == kind]
        techs = sorted(set(r[1] for r in rk))
        X = [[r[2], r[3], r[4], r[5]] + [1 if r[1] == t else 0 for t in techs] for r in rk]
        y = [r[6] for r in rk]
        reg = LinearRegression().fit(X, y)
        kinds[kind] = {'techs': techs, 'coef': [round(float(c), 4) for c in reg.coef_],
                       'intercept': round(float(reg.intercept_), 4),
                       'r2': round(float(reg.score(X, y)), 4)}
    model['regressions'] = kinds
    model['engine'] = 'sklearn-LinearRegression'
    print('R2:', {k: v['r2'] for k, v in kinds.items()})
except Exception as e:
    print('sklearn unavailable, using mean-efficiency fallback:', e)
    model['engine'] = 'mean-fallback'
    model['means'] = {}
    for kind in TECHS:
        for tech in TECHS[kind]:
            vals = [r[6] for r in rows if r[1] == tech]
            model['means'][tech] = round(sum(vals) / len(vals), 2)

json.dump(model, open(OUT, 'w'), indent=1)
print(f'wrote {OUT} ({len(rows)} rows)')
