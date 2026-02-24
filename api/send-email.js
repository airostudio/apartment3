/**
 * Vercel Serverless Function — /api/send-email
 *
 * Sends two emails via Resend (https://resend.com) whenever a booking is confirmed:
 *   1. Guest confirmation — booking summary + check-in details
 *   2. Admin notification — new booking alert
 *
 * Required environment variables (set in Vercel dashboard):
 *   RESEND_API_KEY   — your Resend API key
 *   EMAIL_FROM       — verified sender address (e.g. hello@mtbawbawcascade3.com)
 *   ADMIN_EMAIL      — where admin alerts go  (e.g. hello@mtbawbawcascade3.com)
 *
 * For local testing set these in .env.local and run: vercel dev
 */

const RESEND_API = 'https://api.resend.com/emails';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAIL } = process.env;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  let booking;
  try {
    booking = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const {
    ref         = 'CA3-UNKNOWN',
    guestName   = 'Guest',
    guestEmail,
    checkin,
    checkout,
    nights      = '',
    guests      = '',
    totalAmount = '',
    depositAmount = '',
  } = booking;

  if (!guestEmail) {
    return res.status(400).json({ error: 'guestEmail is required' });
  }

  const fromAddress = EMAIL_FROM || 'Cascade Apartment 3 <onboarding@resend.dev>';
  const adminAddress = ADMIN_EMAIL || fromAddress;

  const checkinFormatted  = formatDate(checkin);
  const checkoutFormatted = formatDate(checkout);

  // ─── 1. Guest confirmation email ─────────────────────────────────────────

  const guestHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed</title>
  <style>
    body { margin: 0; padding: 0; background: #faf8f4; font-family: Inter, Arial, sans-serif; color: #1a1a1a; }
    .wrap { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0f2744; padding: 32px 40px; text-align: center; }
    .header-logo { color: #c9a84c; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
    .header-sub  { color: #8aa3c1; font-size: 13px; margin-top: 4px; }
    .hero { background: #0f2744; padding: 0 40px 40px; text-align: center; }
    .check-icon { width: 56px; height: 56px; border-radius: 50%; background: #c9a84c;
                  display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .hero h1  { color: #ffffff; font-size: 26px; margin: 0 0 8px; }
    .hero-ref { display: inline-block; background: rgba(201,168,76,0.2); color: #c9a84c;
                padding: 6px 18px; border-radius: 20px; font-size: 14px; font-weight: 600;
                letter-spacing: 0.08em; margin-bottom: 0; }
    .body  { padding: 40px; }
    .greeting { font-size: 16px; margin-bottom: 28px; }
    .detail-card { background: #f5f3ef; border-radius: 10px; padding: 24px; margin-bottom: 28px; }
    .detail-card h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em;
                      color: #6b7280; margin: 0 0 16px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0;
                  border-bottom: 1px solid #e5e0d8; font-size: 15px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #6b7280; }
    .detail-value { font-weight: 600; text-align: right; }
    .total-row .detail-value { color: #0f2744; font-size: 17px; }
    .info-box { border-left: 3px solid #c9a84c; padding: 16px 20px; background: #fdf8ee;
                border-radius: 0 8px 8px 0; margin-bottom: 28px; font-size: 15px; line-height: 1.6; }
    .info-box h3 { margin: 0 0 8px; font-size: 14px; color: #9a6f00; text-transform: uppercase; letter-spacing: 0.06em; }
    .footer { background: #f5f3ef; padding: 28px 40px; text-align: center;
              font-size: 13px; color: #6b7280; line-height: 1.6; }
    .footer a { color: #0f2744; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-logo">Cascade Apartment 3</div>
    <div class="header-sub">Mt Baw Baw Alpine Retreat</div>
  </div>
  <div class="hero">
    <div class="check-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0f2744" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <h1>Booking Confirmed!</h1>
    <div class="hero-ref">${escHtml(ref)}</div>
  </div>
  <div class="body">
    <p class="greeting">Hi ${escHtml(guestName)},<br>
    Great news — your stay at Cascade Apartment 3 is confirmed. We can't wait to welcome you to Mt Baw Baw!</p>

    <div class="detail-card">
      <h2>Booking Summary</h2>
      <div class="detail-row">
        <span class="detail-label">Property</span>
        <span class="detail-value">Cascade Apartment 3</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Location</span>
        <span class="detail-value">Baw Baw Village, Mt Baw Baw VIC 3833</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Check-in</span>
        <span class="detail-value">${escHtml(checkinFormatted)} from 2:00 PM</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Check-out</span>
        <span class="detail-value">${escHtml(checkoutFormatted)} by 10:00 AM</span>
      </div>
      ${nights ? `<div class="detail-row">
        <span class="detail-label">Duration</span>
        <span class="detail-value">${escHtml(String(nights))} night${nights === 1 ? '' : 's'}</span>
      </div>` : ''}
      ${guests ? `<div class="detail-row">
        <span class="detail-label">Guests</span>
        <span class="detail-value">${escHtml(String(guests))}</span>
      </div>` : ''}
      ${depositAmount ? `<div class="detail-row">
        <span class="detail-label">Deposit paid</span>
        <span class="detail-value">${escHtml(String(depositAmount))}</span>
      </div>` : ''}
      ${totalAmount ? `<div class="detail-row total-row">
        <span class="detail-label">Total</span>
        <span class="detail-value">${escHtml(String(totalAmount))}</span>
      </div>` : ''}
    </div>

    <div class="info-box">
      <h3>Check-in Information</h3>
      A self-check-in code and detailed directions will be sent to you 3 days before your arrival.
      If you have any questions in the meantime, reply to this email or contact us at
      <a href="mailto:hello@mtbawbawcascade3.com">hello@mtbawbawcascade3.com</a>.
    </div>

    <div class="info-box">
      <h3>Cancellation Policy</h3>
      Free cancellation up to 7 days before check-in. Within 7 days, a 50% refund applies.
      To cancel or modify your booking, contact us directly.
    </div>
  </div>
  <div class="footer">
    <p><strong>Cascade Apartment 3</strong><br>
    Baw Baw Village, Mt Baw Baw VIC 3833<br>
    <a href="mailto:hello@mtbawbawcascade3.com">hello@mtbawbawcascade3.com</a></p>
    <p style="margin-top:16px; color:#9ca3af; font-size:12px;">
      You're receiving this email because you made a booking at cascadeapartment3.com.au.
    </p>
  </div>
</div>
</body>
</html>`;

  // ─── 2. Admin notification email ─────────────────────────────────────────

  const adminHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #1a1a1a; background: #f5f3ef; margin: 0; padding: 0; }
    .wrap { max-width: 540px; margin: 32px auto; background: #fff; border-radius: 10px;
            overflow: hidden; border: 1px solid #e5e0d8; }
    .header { background: #0f2744; color: #c9a84c; padding: 20px 28px; font-weight: 700; font-size: 15px; }
    .body   { padding: 28px; }
    .row    { display: flex; justify-content: space-between; padding: 7px 0;
              border-bottom: 1px solid #f0ece6; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .lbl    { color: #6b7280; }
    .val    { font-weight: 600; text-align: right; }
    .cta    { display: block; margin: 20px 0 0; padding: 12px; background: #0f2744;
              color: #ffffff !important; text-align: center; border-radius: 6px;
              text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">New Booking — ${escHtml(ref)}</div>
  <div class="body">
    <div class="row"><span class="lbl">Guest</span><span class="val">${escHtml(guestName)}</span></div>
    <div class="row"><span class="lbl">Email</span><span class="val">${escHtml(guestEmail)}</span></div>
    <div class="row"><span class="lbl">Check-in</span><span class="val">${escHtml(checkinFormatted)}</span></div>
    <div class="row"><span class="lbl">Check-out</span><span class="val">${escHtml(checkoutFormatted)}</span></div>
    ${nights ? `<div class="row"><span class="lbl">Nights</span><span class="val">${escHtml(String(nights))}</span></div>` : ''}
    ${guests ? `<div class="row"><span class="lbl">Guests</span><span class="val">${escHtml(String(guests))}</span></div>` : ''}
    ${totalAmount ? `<div class="row"><span class="lbl">Total</span><span class="val">${escHtml(String(totalAmount))}</span></div>` : ''}
    <a class="cta" href="https://cascadeapartment3.com.au/admin/bookings.html">View in Admin →</a>
  </div>
</div>
</body>
</html>`;

  // ─── Send both emails ────────────────────────────────────────────────────

  try {
    const [guestResult, adminResult] = await Promise.all([
      sendEmail({
        apiKey: RESEND_API_KEY,
        from: fromAddress,
        to: guestEmail,
        subject: `Booking confirmed — ${ref} · Cascade Apartment 3`,
        html: guestHtml,
      }),
      sendEmail({
        apiKey: RESEND_API_KEY,
        from: fromAddress,
        to: adminAddress,
        subject: `New booking ${ref} — ${guestName} (${checkinFormatted})`,
        html: adminHtml,
      }),
    ]);

    return res.status(200).json({
      success: true,
      guest: guestResult,
      admin: adminResult,
    });
  } catch (err) {
    console.error('Email send failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendEmail({ apiKey, from, to, subject, html }) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Resend error ${res.status}`);
  }
  return data;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
