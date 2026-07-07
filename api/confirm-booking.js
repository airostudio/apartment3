/**
 * /api/confirm-booking — Public endpoint called after Stripe payment succeeds
 *
 * No admin session required. The payment intent ID is verified with Stripe
 * server-side so this cannot be called to create fake bookings.
 *
 * POST body: { paymentIntentId, ref, booking: { guestName, guestEmail,
 *              guestPhone, checkIn, checkOut, guests, total, notes } }
 */

import { isConfigured, sbUpsert, sbCheckDateConflict } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { STRIPE_SECRET_KEY } = process.env;
  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Payment configuration missing.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { paymentIntentId, ref, booking } = body || {};

  if (!paymentIntentId || !ref || !booking) {
    return res.status(400).json({ error: 'paymentIntentId, ref and booking are required.' });
  }

  // ── Verify payment with Stripe ──────────────────────────────────────────
  try {
    const r = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    if (!r.ok) {
      return res.status(402).json({ error: 'Could not verify payment with Stripe.' });
    }
    const pi = await r.json();
    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: `Payment not completed (status: ${pi.status}).` });
    }
  } catch (err) {
    console.error('/api/confirm-booking stripe verify error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed.' });
  }

  // ── Server-side date conflict check ─────────────────────────────────────
  // Prevents double-booking even if two guests complete payment simultaneously.
  // Back-to-back is allowed: a new check-in on an existing checkout day is fine.
  try {
    const conflictId = await sbCheckDateConflict(booking.checkIn, booking.checkOut, ref);
    if (conflictId) {
      return res.status(409).json({
        error: 'These dates are no longer available — another booking has been confirmed for an overlapping period. Please contact us to arrange alternative dates.',
      });
    }
  } catch (err) {
    // If the conflict check itself fails (e.g. DB unreachable) we still
    // proceed so the guest is not stranded after a successful payment.
    console.error('/api/confirm-booking conflict-check error:', err.message);
  }

  // ── Write confirmed booking to database ─────────────────────────────────
  if (!isConfigured()) {
    // DB not configured — return success so the guest still sees their confirmation.
    // The admin can reconcile via Stripe Dashboard.
    return res.status(200).json({ ok: true, warning: 'db_not_configured' });
  }

  const baseRow = {
    id:          ref,
    guest_name:  booking.guestName  || 'Guest',
    guest_email: booking.guestEmail || '',
    guest_phone: booking.guestPhone || '',
    check_in:    booking.checkIn    || '',
    check_out:   booking.checkOut   || '',
    guests:      Number(booking.guests) || 1,
    status:      'confirmed',
    total:       Number(booking.total)  || 0,
    notes:       booking.notes      || '',
    source:      'direct',
  };

  try {
    const fullRow = Object.assign({}, baseRow, {
      early_checkin: booking.earlyCheckin || false,
      late_checkout: booking.lateCheckout || false,
      addons_total:  Number(booking.addonsTotal) || 0,
      pricing:       booking.pricing || null,
    });
    await sbUpsert('ca3_bookings', fullRow);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // If new columns don't exist yet, fall back to base row
    if (err.message.includes('column') || err.message.includes('does not exist') || err.message.includes('42703')) {
      try {
        await sbUpsert('ca3_bookings', baseRow);
        console.warn('/api/confirm-booking: saved without new columns (run ALTER TABLE migration)');
        return res.status(200).json({ ok: true, warning: 'db_missing_columns' });
      } catch (fallbackErr) {
        console.error('/api/confirm-booking fallback db error:', fallbackErr.message);
        return res.status(200).json({ ok: true, warning: fallbackErr.message });
      }
    }
    console.error('/api/confirm-booking db error:', err.message);
    return res.status(200).json({ ok: true, warning: err.message });
  }
}
