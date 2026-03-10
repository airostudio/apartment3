/**
 * /api/property — Property details CRUD
 *
 * GET  /api/property  — Load property data (admin only)
 * POST /api/property  — Save property data (admin only)
 *
 * Stored as a single JSONB row in ca3_settings with key 'ca3_property_v1'.
 */

import { requireSession } from './_auth.js';
import { isConfigured, sbSelect, sbUpsert } from './_supabase.js';

const PROPERTY_KEY = 'ca3_property_v1';

const DEFAULT_PROPERTY = {
  name: 'Cascade Apartment 3',
  type: 'Apartment',
  description: 'Cascade Apartment 3 is a premium ski-in/ski-out alpine apartment located at Falls Creek, Victoria. Sleeping up to 8 guests across 3 bedrooms, it features a full kitchen, cosy fireplace, private balcony with mountain views, ski storage, and access to the resort\'s year-round facilities.',
  address: '4 Bogong High Plains Road',
  city: 'Falls Creek',
  state: 'VIC',
  postcode: '3699',
  country: 'Australia',
  contactEmail: 'hello@mtbawbawcascade3.com',
  contactPhone: '+61 3 5758 1234',
  checkinTime: '14:00',
  checkoutTime: '10:00',
  cancellationPolicy: 'Moderate - 50% refund up to 5 days before check-in',
  minStay: 1,
  maxStay: 30,
  depositPercent: 20,
  amenities: [],
  policies: {
    pets: false,
    smoking: false,
    events: false,
    children: true,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireSession(req, res)) return;

  const dbConfigured = isConfigured();

  /* ── GET ── */
  if (req.method === 'GET') {
    let property = DEFAULT_PROPERTY;
    if (dbConfigured) {
      try {
        const rows = await sbSelect('ca3_settings', `select=value&key=eq.${PROPERTY_KEY}`);
        if (rows.length) property = { ...DEFAULT_PROPERTY, ...rows[0].value };
      } catch (e) {
        console.error('Property GET error:', e.message);
      }
    }
    return res.status(200).json({ property, dbConfigured });
  }

  /* ── POST ── */
  if (req.method === 'POST') {
    if (!dbConfigured) {
      return res.status(503).json({
        error: 'Database not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel.',
        code: 'db_not_configured',
      });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { property } = body;
    if (!property) return res.status(400).json({ error: 'Missing property data.' });
    try {
      await sbUpsert('ca3_settings', {
        key:        PROPERTY_KEY,
        value:      property,
        updated_at: new Date().toISOString(),
      }, 'key');
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Property POST error:', e.message);
      return res.status(500).json({ error: 'Failed to save property.', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
