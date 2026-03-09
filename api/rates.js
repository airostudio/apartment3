import { requireSession } from './_auth.js';
import { isConfigured, sbSelect, sbUpsert } from './_supabase.js';

/**
 * /api/rates — Seasonal rate management
 *
 * GET  /api/rates  — Return current rates (public — used by booking widget)
 * POST /api/rates  — Save rates (admin only)
 *
 * Stores rates as a single JSONB row in ca3_settings with key 'ca3_rates_v1'.
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
    'ski-midweek': { name: 'White Season Midweek Rate',         condition: 'Sunday–Thursday during White/Ski Season (June–September)',          discount: 0  },
    'ski-weekend': { name: 'White Season Weekend Rate',         condition: 'Friday–Sunday during White/Ski Season (June–September)',            discount: 0  },
    'vic-school':  { name: 'Victorian School Holidays Premium', condition: 'Additional charge during July & September VIC school holidays',     discount: 0  },
    '7night':      { name: 'Minimum 7-Night Stay Discount',     condition: 'When guest books 7 or more consecutive nights',                    discount: 10 },
    'earlybird':   { name: 'Early Bird Discount',               condition: 'When booking is made 60+ days in advance',                        discount: 15 },
    'lastminute':  { name: 'Last Minute Discount',              condition: 'When booking is made within 3 days of check-in',                  discount: 10 },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const dbConfigured = isConfigured();

  /* ── GET ── */
  if (req.method === 'GET') {
    let rates = DEFAULT_RATES;
    if (dbConfigured) {
      try {
        const rows = await sbSelect('ca3_settings', `select=value&key=eq.${RATES_KEY}`);
        if (rows.length) rates = rows[0].value;
      } catch (e) {
        console.error('Rates GET error:', e.message);
      }
    }
    return res.status(200).json({ rates, dbConfigured });
  }

  /* ── POST ── */
  if (req.method === 'POST') {
    if (!requireSession(req, res)) return;
    if (!dbConfigured) {
      return res.status(503).json({
        error: 'Database not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your Vercel project.',
        code: 'db_not_configured',
      });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { rates } = body;
    if (!rates) return res.status(400).json({ error: 'Missing rates data.' });
    try {
      await sbUpsert('ca3_settings', {
        key:        RATES_KEY,
        value:      rates,
        updated_at: new Date().toISOString(),
      }, 'key');
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Rates POST error:', e.message);
      return res.status(500).json({ error: 'Failed to save rates.', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
