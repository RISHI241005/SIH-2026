"""Remove seeded Day-N recs + upload rows from sim CSV (fresh start before correct seed)."""
import csv, json, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE, 'data', 'db.json')
DS = os.path.join(BASE, 'ml', 'dataset_simulator.csv')

pat = re.compile(r'^Day \d+ (routine|storage|dispatch) log$')
d = json.load(open(DB, encoding='utf-8'))
for kind in ('production', 'storage', 'transmission'):
    before = len(d['daily'][kind])
    d['daily'][kind] = [r for r in d['daily'][kind] if not pat.match((r.get('data') or {}).get('notes', ''))]
    print(kind, f'{before} -> {len(d["daily"][kind])}')
json.dump(d, open(DB, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

if os.path.exists(DS):
    rows = [r for r in csv.DictReader(open(DS)) if r.get('src') != 'upload']
    with open(DS, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['kind', 'tech', 'capacityKW', 'hours', 'tempC', 'loadPct', 'efficiencyPct', 'src'])
        w.writeheader(); w.writerows(rows)
    print('sim CSV upload rows cleared, kept', len(rows))
