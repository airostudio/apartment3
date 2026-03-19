import { isConfigured, sbSelect } from './_supabase.js';

/**
 * GET /api/available-dates — public endpoint returning booked date ranges only.
 * No guest PII is exposed. Used by the booking widget to block unavailable dates.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!isConfigured()) {
    return res.status(200).json({ bookings: [] });
  }

  try {
    const rows = await sbSelect(
      'ca3_bookings',
      'select=id,check_in,check_out,status&status=neq.cancelled&order=check_in.asc'
    );

    const bookings = rows.map(function (r) {
      return {
        id:       r.id,
        checkIn:  r.check_in,
        checkOut: r.check_out,
        status:   r.status,
        // Legacy aliases used by isDateBooked()
        checkin:  r.check_in,
        checkout: r.check_out,
      };
    });

    return res.status(200).json({ bookings });
  } catch (err) {
    console.error('/api/available-dates error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
