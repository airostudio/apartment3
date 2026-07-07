import { requireSession } from './_auth.js';
import { isConfigured, sbSelect, sbInsert, sbUpdate, sbDelete, sbCheckDateConflict } from './_supabase.js';

/**
 * /api/bookings — CRUD for bookings
 *
 * GET    /api/bookings          — list all bookings (admin only)
 * POST   /api/bookings          — create booking (admin only)
 * PUT    /api/bookings          — update booking { id, changes } (admin only)
 * DELETE /api/bookings          — delete booking { id } (admin only)
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
      bookings: [],
    });
  }

  try {
    /* ── GET ── */
    if (req.method === 'GET') {
      const rows = await sbSelect('ca3_bookings', 'select=*&order=created_at.desc');
      return res.status(200).json({ bookings: rows.map(mapRow) });
    }

    /* ── POST (create) ── */
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!b.guestName && !b.guest_name) return res.status(400).json({ error: 'guestName is required' });

      const checkIn  = b.checkIn  || b.check_in  || '';
      const checkOut = b.checkOut || b.check_out || '';
      if (checkIn && checkOut) {
        const conflictId = await sbCheckDateConflict(checkIn, checkOut);
        if (conflictId) {
          return res.status(409).json({ error: `Dates conflict with existing booking ${conflictId}.` });
        }
      }

      const row = toRow(b);
      const inserted = await sbInsert('ca3_bookings', row);
      return res.status(201).json({ booking: mapRow(inserted[0] || row) });
    }

    /* ── PUT (update) ── */
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, changes } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const checkIn  = changes.checkIn  || changes.check_in  || '';
      const checkOut = changes.checkOut || changes.check_out || '';
      if (checkIn && checkOut) {
        const conflictId = await sbCheckDateConflict(checkIn, checkOut, id);
        if (conflictId) {
          return res.status(409).json({ error: `Dates conflict with existing booking ${conflictId}.` });
        }
      }

      const row = toRow(changes);
      row.updated_at = new Date().toISOString();
      const updated = await sbUpdate('ca3_bookings', { id }, row);
      return res.status(200).json({ booking: mapRow(updated[0] || { id, ...row }) });
    }

    /* ── DELETE ── */
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      await sbDelete('ca3_bookings', { id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('/api/bookings error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

/* ── field mapping (camelCase JS <-> snake_case DB) ── */

function toRow(b) {
  const row = {};
  if (b.id            !== undefined) row.id            = b.id;
  if (b.guestName     !== undefined) row.guest_name    = b.guestName;
  if (b.guest_name    !== undefined) row.guest_name    = b.guest_name;
  if (b.guestEmail    !== undefined) row.guest_email   = b.guestEmail;
  if (b.guest_email   !== undefined) row.guest_email   = b.guest_email;
  if (b.guestPhone    !== undefined) row.guest_phone   = b.guestPhone;
  if (b.guest_phone   !== undefined) row.guest_phone   = b.guest_phone;
  if (b.checkIn       !== undefined) row.check_in      = b.checkIn;
  if (b.check_in      !== undefined) row.check_in      = b.check_in;
  if (b.checkOut      !== undefined) row.check_out     = b.checkOut;
  if (b.check_out     !== undefined) row.check_out     = b.check_out;
  if (b.guests        !== undefined) row.guests        = b.guests;
  if (b.status        !== undefined) row.status        = b.status;
  if (b.total         !== undefined) row.total         = typeof b.total === 'string' ? parseFloat(b.total.replace(/[^0-9.]/g, '')) || 0 : b.total;
  if (b.notes         !== undefined) row.notes         = b.notes;
  if (b.source        !== undefined) row.source        = b.source;
  if (b.earlyCheckin  !== undefined) row.early_checkin = b.earlyCheckin;
  if (b.early_checkin !== undefined) row.early_checkin = b.early_checkin;
  if (b.lateCheckout  !== undefined) row.late_checkout = b.lateCheckout;
  if (b.late_checkout !== undefined) row.late_checkout = b.late_checkout;
  if (b.addonsTotal   !== undefined) row.addons_total  = typeof b.addonsTotal === 'number' ? b.addonsTotal : parseFloat(b.addonsTotal) || 0;
  if (b.addons_total  !== undefined) row.addons_total  = typeof b.addons_total === 'number' ? b.addons_total : parseFloat(b.addons_total) || 0;
  if (b.pricing       !== undefined) row.pricing       = b.pricing;
  return row;
}

function mapRow(r) {
  return {
    id:           r.id,
    guestName:    r.guest_name,
    guestEmail:   r.guest_email || '',
    guestPhone:   r.guest_phone || '',
    checkIn:      r.check_in,
    checkOut:     r.check_out,
    guests:       r.guests || 1,
    status:       r.status || 'confirmed',
    total:        typeof r.total === 'number' ? r.total : parseFloat(r.total) || 0,
    notes:        r.notes || '',
    source:       r.source || 'direct',
    earlyCheckin: r.early_checkin || false,
    lateCheckout: r.late_checkout || false,
    addonsTotal:  typeof r.addons_total === 'number' ? r.addons_total : parseFloat(r.addons_total) || 0,
    pricing:      r.pricing || null,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
    // Legacy aliases used by admin pages
    name:         r.guest_name,
    email:        r.guest_email || '',
    checkin:      r.check_in,
    checkout:     r.check_out,
    ref:          r.id,
  };
}
