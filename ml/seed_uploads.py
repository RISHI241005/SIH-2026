"""Seed 10 uploads per area (production/storage/transmission) with consistent techs.
Run: python ml/seed_uploads.py   (server must be running on :8080)
"""
import json, urllib.request

BASE = 'http://localhost:8080'

def call(path, token=None, data=None):
    req = urllib.request.Request(BASE + path, method='POST' if data is not None else 'GET',
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    return json.load(urllib.request.urlopen(req, timeout=30))

tok = call('/api/auth/login', data={'email': 'admin@renew.io', 'password': 'admin123'})['token']

# ---------- 10 production uploads (consistent techs, consistent physics) ----------
# machine efficiency = produced / (capKW * hours) lands ~88-94% (realistic)
for i in range(10):
    h = 6 + (i % 3)
    eff = 0.88 + (i % 4) * 0.02
    w = round(2.6 + (i % 4) * 0.3, 1)
    s = round(2.8 + (i % 3) * 0.3, 1)
    hy = round(3.4 + (i % 4) * 0.3, 1)
    tot = round(w + s + hy, 1)
    wc, sc, hc = round(w / (h * eff), 2), round(s / (h * eff), 2), round(hy / (h * eff), 2)
    call('/api/daily/production', tok, {
        'producedKW': tot, 'hours': h, 'solarKW': s, 'windKW': w, 'hydroKW': hy,
        'machines': [
            {'type': 'wind', 'name': f'Windmill-{i % 3 + 1}', 'tech': 'Wind-DirectDrive 4MW', 'capKW': wc, 'hours': h, 'producedKW': w},
            {'type': 'solar', 'name': f'Solar-Array-{i % 2 + 1}', 'tech': 'Solar-TOPCon 580W', 'capKW': sc, 'hours': h, 'producedKW': s},
            {'type': 'hydro', 'name': f'Hydro-Turbine-{i % 2 + 1}', 'tech': 'Hydro-Kaplan', 'capKW': hc, 'hours': h, 'producedKW': hy},
        ],
        'notes': f'Day {i + 1} routine log',
    })
print('production: 10 done')

# ---------- 10 storage uploads (Li-ion LFP throughout) ----------
for i in range(10):
    recv = round(9.0 + (i % 4) * 0.4, 1)
    stored = round(recv * (0.9 + (i % 3) * 0.02), 1)
    emer = round(stored * 0.18, 1)
    sent = round(stored * 0.94, 1)
    call('/api/daily/storage', tok, {
        'storedKW': stored, 'emergencyKW': emer, 'receivedKW': recv, 'sentKW': sent,
        'batteries': [
            {'name': 'Battery-A', 'tech': 'Li-ion LFP', 'cap': 6.0, 'stored': round(stored * 0.55, 1), 'charges': 1 + (i % 2), 'discharges': i % 2},
            {'name': 'Battery-B', 'tech': 'Li-ion LFP', 'cap': 5.0, 'stored': round(stored * 0.45, 1), 'charges': 1, 'discharges': 0},
        ],
        'notes': f'Day {i + 1} storage log',
    })
print('storage: 10 done')

# ---------- 10 transmission uploads ----------
areas = ['Block-A', 'Block-B', 'Street-Lights', 'Canteen']
for i in range(10):
    recv = round(8.6 + (i % 4) * 0.3, 1)
    dist = round(recv * (0.93 + (i % 2) * 0.02), 1)
    shares = [0.4, 0.3, 0.2, 0.1]
    call('/api/daily/transmission', tok, {
        'totalReceivedKW': recv, 'totalDistributedKW': dist,
        'reservedKW': round(recv - dist, 1), 'shortageKW': 0 if i % 3 else 0.2, 'excessKW': round(max(0, dist - 8.0), 1),
        'sectors': [{'name': a, 'kw': round(dist * sh, 1)} for a, sh in zip(areas, shares)],
        'notes': f'Day {i + 1} dispatch log',
    })
print('transmission: 10 done')
print('SEED COMPLETE')
