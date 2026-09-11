# UrjaSetu — Renewable Energy Manager (Solar · Wind · Hydro)

Plan-strict hackathon build: **generate + manage** renewable energy more efficiently in **one website**.
Flow per source: **Forecast → Production → Storage → Distribution**. AI detects, alerts, plans — **Admin approves or makes his own decision**.

## Run
```
cd "C:\Users\Soumadip Nag\Documents\Default Project"
npm install
python ml/generate_dataset.py
python ml/train_models.py      # needs: pip install scikit-learn
node server.js
```
Open http://localhost:8080 — demo admin **admin@renew.io / admin123**.

## Website map (exactly per plan)
- **Home**: welcome, what the site does, rotating renewable tips (auto-slide), Login button top-right, Contact us at bottom.
- **Login**: Step 1 scale (**Large / Small**), Step 2 role (**Admin, Weather / Production / Storage / Transmission uploader**), then Login or Create account.
- **Admin** (7 sections): **Dashboard** (produced / stored / distributed / alerts / pending approvals, all clickable) · **Energy Tracking** (3 zones Solar/Wind/Hydro → 4 stages Forecast→Production→Storage→Distribution, each with statistics, active problems, predicted problems, health bar, performance; red ❗ on problem stages; problem → what/why/how/past/AI solution/aim → Approve / Reject / Make-a-Solution) · **Approvals** (live + stored problems) · **AI Desk** (chat research + make-your-own-decision + optional Gemini key) · **Forecasts** (Kolkata / Delhi / Mumbai / Hyderabad: past 7-day archive + present live + future 7-day + AI outlook) · **Feedback** (rating + history diary) · **Complaints** (raise vs distribution authority + history).
- **Uploaders**: personal dashboard (18:00 daily reminder, total uploads, miss = inconsistency) + exact daily forms — weather (hist+today+forecast), production (kW + hours), storage (stored + emergency + sent), transmission (rooms + street lights + food court). Plus PDF/Word/Excel file ingest with auto-numeric-row import.

## AI — 4 trained ML models (`ml/`)
1. **Problem detector**: RandomForest (80 trees) on `ml/dataset_problem.csv` (**1200 rows**) — **85.0%** test accuracy, majority vote in Node.
2. **Solution maker**: learned problem-class → ranked solutions; admin feedback retrains it live.
3. **Chatbot co-pilot**: TF-IDF over 68-pair KB; learns every chat + manual solution.
4. **Simulator**: LinearRegression per stage on `ml/dataset_simulator.csv` (**930 rows = 900 dummy + 30 real upload measurements**, R² 0.83–0.96, MAE 2.0 pts on real rows) — predicts tech efficiency, scores workflows, suggests best tech swaps. Retrain: `python ml/seed_uploads.py && python ml/augment_simulator.py && python ml/train_models.py`.
- Optional **Gemini API** (free tier, key pasted in AI Desk) enriches chat/explanations; everything works offline without it.
- Fake-data guard: calculated-vs-actual roadmap with **±7% tolerance** (minor deficit tolerated, ≥2 breaches or >20% = FAULTY).

## Backend / Database / Weather API
- `server.js` — Express API + static frontend. `db.js` + `data/db.json` — users (scale+role), daily uploads, decisions, feedbacks, complaints, readings, equipment, batteries, stations, 30-day history.
- `weather.js` — live **Open-Meteo** (no key): current + 7-day forecast + 7-day archive for **Kolkata, Delhi, Mumbai, Hyderabad**, with offline snapshot fallback.

## Loading scenes
Every route shows a loading scene (spinner + rotating ops tip) so fetches never look frozen.
