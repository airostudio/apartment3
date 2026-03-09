/**
 * /api/rates — Serverless rate management (Vercel Postgres / Neon)
 *
 * GET  /api/rates  — Return current rates (Postgres → default fallback)
 * POST /api/rates  — Save rates to Postgres
 *
 * Uses Neon's HTTP SQL endpoint — no npm packages required, just fetch().
 * Vercel Postgres automatically adds these env vars when you connect the
 * database to your project:
 *   POSTGRES_URL              — pooled connection string
 *   POSTGRES_URL_NON_POOLING  — direct connection string (preferred for HTTP API)
 *
 * The API auto-creates the settings table on first use.
 */

const RATES_KEY = 'ca3_rates_v1';

const DEFAULT_RATES = {
  seasons: {
    white: {
      name: 'White Season',
      subLabel: 'Winter / Ski Season',
      dates: 'June – September',
      months: [6, 7, 8, 9],
      ratePerNight: 420,
      minStay: 2,
    },
    green: {
      name: 'Green Season',
      subLabel: 'Summer / Holiday Season',
      dates: 'December – February',
      months: [12, 1, 2],
      ratePerNight: 280,
      minStay: 1,
    },
    shoulder: {
      name: 'Shoulder Season',
      subLabel: 'Off-peak',
      dates: 'March – May, October – November',
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
    'ski-midweek': { name: 'White Season Midweek Rate',         condition: 'Sunday–Thursday during White/Ski Season (June–September)',             discount: 0  },
    'ski-weekend': { name: 'White Season Weekend Rate',         condition: 'Friday–Sunday during White/Ski Season (June–September)',               discount: 0  },
    'vic-school':  { name: 'Victorian School Holidays Premium', condition: 'Additional charge during July & September VIC school holidays',        discount: 0  },
    '7night':      { name: 'Minimum 7-Night Stay Discount',     condition: 'When guest books 7 or more consecutive nights',                        discount: 10 },
    'earlybird':   { name: 'Early Bird Discount',               condition: 'When booking is made 60+ days in advance',                            discount: 15 },
    'lastminute':  { name: 'Last Minute Discount',              condition: 'When booking is made within 3 days of check-in',                      discount: 10 },
  },
};

/* ── Neon HTTP SQL helper ─────────────────────────────────────────────── */

function getConnectionString() {
  // Prefer non-pooling URL for the HTTP API (avoids PgBouncer compatibility issues)
  return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || null;
}

async function pgQuery(connectionString, query, params = []) {
  const u = new URL(connectionString);
  const host = u.hostname;
  const password = decodeURIComponent(u.password);

  const r = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${password}`,
      'Content-Type': 'application/json',
      'Neon-Connection-String': connectionString,
    },
    body: JSON.stringify({ query, params }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Postgres HTTP ${r.status}: ${text}`);
  }
  return r.json();
}

async function ensureTable(connectionString) {
  await pgQuery(connectionString,
    `CREATE TABLE IF NOT EXISTS ca3_settings (
       key   TEXT PRIMARY KEY,
       value JSONB NOT NULL,
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`
  );
}

async function getRates(connectionString) {
  const result = await pgQuery(connectionString,
    'SELECT value FROM ca3_settings WHERE key = $1',
    [RATES_KEY]
  );
  return result.rows?.[0]?.value ?? null;
}

async function saveRates(connectionString, rates) {
  await pgQuery(connectionString,
    `INSERT INTO ca3_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW()`,
    [RATES_KEY, JSON.stringify(rates)]
  );
}

/* ── Handler ─────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const connectionString = getConnectionString();
  const dbConfigured = !!connectionString;

  /* ── GET ── */
  if (req.method === 'GET') {
    let rates = DEFAULT_RATES;
    if (dbConfigured) {
      try {
        await ensureTable(connectionString);
        const saved = await getRates(connectionString);
        if (saved) rates = saved;
      } catch (e) {
        console.error('Postgres GET error:', e.message);
      }
    }
    return res.status(200).json({ rates, dbConfigured });
  }

  /* ── POST ── */
  if (req.method === 'POST') {
    if (!dbConfigured) {
      return res.status(503).json({
        error: 'Database not configured. Add a Vercel Postgres database to your project.',
        code: 'db_not_configured',
      });
    }
    const { rates } = req.body;
    if (!rates) return res.status(400).json({ error: 'Missing rates data.' });
    try {
      await ensureTable(connectionString);
      await saveRates(connectionString, rates);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Postgres POST error:', e.message);
      return res.status(500).json({ error: 'Failed to save rates.', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
