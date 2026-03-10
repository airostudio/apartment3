/**
 * /api/settings — Admin settings CRUD
 *
 * GET  /api/settings  — Load settings (admin only)
 * POST /api/settings  — Save settings (admin only)
 *
 * Stored as a single JSONB row in ca3_settings with key 'ca3_admin_settings_v1'.
 */

import { requireSession } from './_auth.js';
import { isConfigured, sbSelect, sbUpsert } from './_supabase.js';

const SETTINGS_KEY = 'ca3_admin_settings_v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireSession(req, res)) return;

  const dbConfigured = isConfigured();

  /* ── GET ── */
  if (req.method === 'GET') {
    if (!dbConfigured) return res.status(200).json({ settings: null, dbConfigured: false });
    try {
      const rows = await sbSelect('ca3_settings', `select=value&key=eq.${SETTINGS_KEY}`);
      return res.status(200).json({ settings: rows.length ? rows[0].value : null, dbConfigured: true });
    } catch (e) {
      console.error('Settings GET error:', e.message);
      return res.status(500).json({ error: e.message });
    }
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
    const { settings } = body;
    if (!settings) return res.status(400).json({ error: 'Missing settings data.' });
    try {
      await sbUpsert('ca3_settings', {
        key:        SETTINGS_KEY,
        value:      settings,
        updated_at: new Date().toISOString(),
      }, 'key');
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Settings POST error:', e.message);
      return res.status(500).json({ error: 'Failed to save settings.', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
