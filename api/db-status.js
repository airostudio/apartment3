/**
 * /api/db-status — Quick Supabase connectivity check
 * Returns { ok: bool, configured: bool, error?: string }
 */

import { requireSession } from './_auth.js';
import { isConfigured } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireSession(req, res)) return;

  const configured = isConfigured();
  if (!configured) {
    return res.status(200).json({ ok: false, configured: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' });
  }

  try {
    const url = process.env.SUPABASE_URL.replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${url}/rest/v1/ca3_bookings?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(200).json({ ok: false, configured: true, error: `HTTP ${r.status}: ${text.slice(0, 120)}` });
    }
    return res.status(200).json({ ok: true, configured: true });
  } catch (e) {
    return res.status(200).json({ ok: false, configured: true, error: e.message });
  }
}
