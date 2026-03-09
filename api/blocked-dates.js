import { requireSession } from './_auth.js';
import { isConfigured, sbSelect, sbInsert, sbDelete } from './_supabase.js';

/**
 * /api/blocked-dates — CRUD for blocked/unavailable date ranges
 *
 * GET    /api/blocked-dates     — list all blocked ranges (public — needed by booking widget)
 * POST   /api/blocked-dates     — create blocked range (admin only)
 * DELETE /api/blocked-dates     — remove blocked range { id } (admin only)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'Database not configured.',
      code: 'db_not_configured',
      blocked: [],
    });
  }

  try {
    /* ── GET (public) ── */
    if (req.method === 'GET') {
      const rows = await sbSelect('ca3_blocked_dates', 'select=*&order=start_date.asc');
      return res.status(200).json({ blocked: rows.map(mapRow) });
    }

    /* ── POST (create) — admin only ── */
    if (req.method === 'POST') {
      if (!requireSession(req, res)) return;
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!b.startDate && !b.start_date) return res.status(400).json({ error: 'startDate is required' });
      if (!b.endDate   && !b.end_date)   return res.status(400).json({ error: 'endDate is required' });

      const row = {
        id:         b.id || genId(),
        start_date: b.startDate || b.start_date,
        end_date:   b.endDate   || b.end_date,
        reason:     b.reason || '',
      };
      const inserted = await sbInsert('ca3_blocked_dates', row);
      return res.status(201).json({ blocked: mapRow(inserted[0] || row) });
    }

    /* ── DELETE — admin only ── */
    if (req.method === 'DELETE') {
      if (!requireSession(req, res)) return;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      await sbDelete('ca3_blocked_dates', { id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('/api/blocked-dates error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function mapRow(r) {
  return {
    id:        r.id,
    startDate: r.start_date,
    endDate:   r.end_date,
    reason:    r.reason || '',
    createdAt: r.created_at,
  };
}

function genId() {
  return 'BL-' + Date.now().toString(36).toUpperCase();
}
