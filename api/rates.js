/**
 * /api/rates — Serverless rate management
 *
 * GET  /api/rates  — Return current rates (Vercel KV → default fallback)
 * POST /api/rates  — Save rates to Vercel KV
 *
 * Server-side persistence requires Vercel KV (built on Upstash Redis).
 * Set up in your Vercel dashboard under Storage → KV, then link to this
 * project. Two env vars are automatically added:
 *   KV_REST_API_URL   — Vercel KV REST endpoint
 *   KV_REST_API_TOKEN — Vercel KV REST auth token
 *
 * Without KV configured, GET returns the hardcoded defaults below and
 * POST returns HTTP 503 with code "kv_not_configured".
 */

const RATES_KEY = 'ca3_rates_v1';

const DEFAULT_RATES = {
  seasons: {
    white: {
      name: 'White Season',
      subLabel: 'Winter / Ski Season',
      dates: 'June \u2013 September',
      months: [6, 7, 8, 9],
      ratePerNight: 420,
      minStay: 2,
    },
    green: {
      name: 'Green Season',
      subLabel: 'Summer / Holiday Season',
      dates: 'December \u2013 February',
      months: [12, 1, 2],
      ratePerNight: 280,
      minStay: 1,
    },
    shoulder: {
      name: 'Shoulder Season',
      subLabel: 'Off-peak',
      dates: 'March \u2013 May, October \u2013 November',
      months: [3, 4, 5, 10, 11],
      ratePerNight: 200,
      minStay: 1,
    },
  },
  fees: {
    cleaning:   { name: 'Cleaning Fee',  amount: 120, type: 'Per Stay',  isPercent: false },
    service:    { name: 'Service Fee',   amount: 0,   type: 'Per Stay',  isPercent: true  },
    extraguest: { name: 'Extra Guest',   amount: 30,  type: 'Per Night', isPercent: false },
    pet:        { name: 'Pet Fee',       amount: 50,  type: 'Per Stay',  isPercent: false },
  },
  rules: {
    'ski-midweek': { name: 'White Season Midweek Rate',           condition: 'Sunday\u2013Thursday during White/Ski Season (June\u2013September)',                                            discount: 0  },
    'ski-weekend':  { name: 'White Season Weekend Rate',           condition: 'Friday\u2013Sunday during White/Ski Season (June\u2013September)',                                              discount: 0  },
    'vic-school':   { name: 'Victorian School Holidays Premium',   condition: 'Additional charge during July & September VIC school holidays',                                                discount: 0  },
    '7night':       { name: 'Minimum 7-Night Stay Discount',       condition: 'When guest books 7 or more consecutive nights',                                                                discount: 10 },
    'earlybird':    { name: 'Early Bird Discount',                 condition: 'When booking is made 60+ days in advance',                                                                     discount: 15 },
    'lastminute':   { name: 'Last Minute Discount',                condition: 'When booking is made within 3 days of check-in',                                                               discount: 10 },
  },
};

/* ── Vercel KV helpers (Upstash Redis REST API via pipeline) ── */
async function kvGet(url, token, key) {
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['GET', key]]),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const result = data[0]?.result;
  return result ? JSON.parse(result) : null;
}

async function kvSet(url, token, key, value) {
  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
  });
  return r.ok;
}

function findKvEnv(suffix) {
  for (const [key, val] of Object.entries(process.env)) {
    if (key !== suffix && key.endsWith('_' + suffix) && val) return val;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Support both standard Vercel KV names and custom-prefixed store names
  // (e.g. MYSTORE_KV_REST_API_URL when the KV store was created with a custom name)
  const KV_REST_API_URL   = process.env.KV_REST_API_URL   || findKvEnv('KV_REST_API_URL');
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || findKvEnv('KV_REST_API_TOKEN');
  const kvConfigured = !!(KV_REST_API_URL && KV_REST_API_TOKEN);

  /* ── GET ── */
  if (req.method === 'GET') {
    let rates = DEFAULT_RATES;
    if (kvConfigured) {
      try {
        const saved = await kvGet(KV_REST_API_URL, KV_REST_API_TOKEN, RATES_KEY);
        if (saved) rates = saved;
      } catch (e) {
        console.error('KV get error:', e);
      }
    }
    return res.status(200).json({ rates, kvConfigured });
  }

  /* ── POST ── */
  if (req.method === 'POST') {
    if (!kvConfigured) {
      return res.status(503).json({
        error: 'Server-side rate storage is not configured. Add a Vercel KV store to your project.',
        code: 'kv_not_configured',
      });
    }
    const { rates } = req.body;
    if (!rates) return res.status(400).json({ error: 'Missing rates data.' });
    try {
      const ok = await kvSet(KV_REST_API_URL, KV_REST_API_TOKEN, RATES_KEY, rates);
      if (!ok) throw new Error('KV set returned not-ok');
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('KV set error:', e);
      return res.status(500).json({ error: 'Failed to save rates to storage.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
