// Gemini (Google AI Studio, free tier) integration.
// Get a free key at https://aistudio.google.com/app/apikey
// Set via env GEMINI_API_KEY or POST /api/config/gemini { key } (admin, in-memory).
// All callers MUST fall back to the built-in rule engine when unconfigured/failing.

let sessionKey = '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function getKey() { return sessionKey || process.env.GEMINI_API_KEY || ''; }
function isConfigured() { return !!getKey(); }
function setKey(k) { sessionKey = (k || '').trim(); }

async function generate(prompt, opts = {}) {
  const key = getKey();
  if (!key) return { ok: false, reason: 'no-key' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system || 'You are UrjaSetu, an expert renewable-energy (wind/solar/hydro) operations analyst. Be concise, numeric, and practical.' }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 800 }
        })
      }
    );
    clearTimeout(t);
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return { ok: false, reason: `gemini-http-${r.status}`, detail: txt.slice(0, 300) };
    }
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!text) return { ok: false, reason: 'empty-response' };
    return { ok: true, text, model: MODEL };
  } catch (e) { return { ok: false, reason: 'network-error', detail: String(e.message || e).slice(0, 200) }; }
}

module.exports = { generate, isConfigured, setKey, getKey, MODEL };
