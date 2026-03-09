import { requireSession } from './_auth.js';
import { isConfigured, sbSelect, sbInsert, sbUpdate, sbDelete } from './_supabase.js';

/**
 * /api/ical-connections — CRUD for iCal feed connections
 *
 * GET    /api/ical-connections  — list all connections (admin only)
 * POST   /api/ical-connections  — add connection (admin only)
 * PUT    /api/ical-connections  — update connection { id, changes } (admin only)
 * DELETE /api/ical-connections  — remove connection { id } (admin only)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireSession(req, res)) return;

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'Database not configured.',
      code: 'db_not_configured',
      connections: [],
    });
  }

  try {
    /* ── GET ── */
    if (req.method === 'GET') {
      const rows = await sbSelect('ca3_ical_connections', 'select=*&order=created_at.asc');
      return res.status(200).json({ connections: rows.map(mapRow) });
    }

    /* ── POST (add) ── */
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!b.name) return res.status(400).json({ error: 'name is required' });
      if (!b.url)  return res.status(400).json({ error: 'url is required' });

      const row = {
        id:        b.id || genId(),
        name:      b.name,
        url:       b.url,
        platform:  b.platform || '',
        direction: b.direction || 'import',
        last_sync: b.lastSync || b.last_sync || null,
      };
      const inserted = await sbInsert('ca3_ical_connections', row);
      return res.status(201).json({ connection: mapRow(inserted[0] || row) });
    }

    /* ── PUT (update) ── */
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, changes } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const row = {};
      if (changes.name      !== undefined) row.name      = changes.name;
      if (changes.url       !== undefined) row.url       = changes.url;
      if (changes.platform  !== undefined) row.platform  = changes.platform;
      if (changes.direction !== undefined) row.direction = changes.direction;
      if (changes.lastSync  !== undefined) row.last_sync = changes.lastSync;

      const updated = await sbUpdate('ca3_ical_connections', { id }, row);
      return res.status(200).json({ connection: mapRow(updated[0] || { id, ...row }) });
    }

    /* ── DELETE ── */
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      await sbDelete('ca3_ical_connections', { id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('/api/ical-connections error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function mapRow(r) {
  return {
    id:        r.id,
    name:      r.name,
    url:       r.url,
    platform:  r.platform || '',
    direction: r.direction || 'import',
    lastSync:  r.last_sync || null,
    createdAt: r.created_at,
  };
}

function genId() {
  return 'IC-' + Date.now().toString(36).toUpperCase();
}
