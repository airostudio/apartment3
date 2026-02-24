/**
 * Vercel Serverless Function — /api/contact
 *
 * Handles contact form submissions from the front page.
 * Sends an enquiry notification to hello@mtbawbawcascade3.com
 * and an auto-reply acknowledgement to the sender.
 *
 * Required environment variables (set in Vercel dashboard):
 *   RESEND_API_KEY   — your Resend API key
 *   EMAIL_FROM       — verified sender address (e.g. hello@mtbawbawcascade3.com)
 *
 * For local testing set these in .env.local and run: vercel dev
 */

const RESEND_API   = 'https://api.resend.com/emails';
const CONTACT_DEST = 'hello@mtbawbawcascade3.com';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { RESEND_API_KEY, EMAIL_FROM } = process.env;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — returning not_configured so client can fall back to mailto');
    return res.status(503).json({ error: 'Email service not configured', code: 'not_configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const {
    name    = '',
    email   = '',
    phone   = '',
    subject = 'General Enquiry',
    message = '',
  } = body;

  // Basic validation
  if (!name.trim())    return res.status(400).json({ error: 'Name is required' });
  if (!email.trim())   return res.status(400).json({ error: 'Email is required' });
  if (!message.trim()) return res.status(400).json({ error: 'Message is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const fromAddress = EMAIL_FROM || 'Cascade Apartment 3 <onboarding@resend.dev>';
  const timestamp   = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    dateStyle: 'full', timeStyle: 'short',
  });

  // ─── Admin notification email ─────────────────────────────────────────────

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
    .header-sub { color: #8aa3c1; font-size: 12px; font-weight: 400; margin-top: 3px; }
    .body   { padding: 28px; }
    .row    { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f0ece6; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .lbl    { color: #6b7280; min-width: 80px; flex-shrink: 0; }
    .val    { font-weight: 600; word-break: break-word; }
    .msg-box { margin-top: 20px; padding: 16px; background: #f9f7f4; border-radius: 8px;
               border-left: 3px solid #c9a84c; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
    .msg-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
                 color: #9a6f00; margin-bottom: 8px; }
    .cta  { display: block; margin: 24px 0 0; padding: 12px; background: #0f2744;
            color: #ffffff !important; text-align: center; border-radius: 6px;
            text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { padding: 16px 28px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f0ece6; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    New Enquiry — ${escHtml(subject)}
    <div class="header-sub">Cascade Apartment 3 · Contact Form</div>
  </div>
  <div class="body">
    <div class="row"><span class="lbl">From</span><span class="val">${escHtml(name)}</span></div>
    <div class="row"><span class="lbl">Email</span><span class="val"><a href="mailto:${escHtml(email)}" style="color:#0f2744;">${escHtml(email)}</a></span></div>
    ${phone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${escHtml(phone)}</span></div>` : ''}
    <div class="row"><span class="lbl">Subject</span><span class="val">${escHtml(subject)}</span></div>
    <div class="row"><span class="lbl">Received</span><span class="val">${escHtml(timestamp)}</span></div>
    <div class="msg-box">
      <div class="msg-label">Message</div>
      ${escHtml(message)}
    </div>
    <a class="cta" href="mailto:${escHtml(email)}?subject=Re: ${encodeURIComponent(subject)} — Cascade Apartment 3">Reply to ${escHtml(name)} →</a>
  </div>
  <div class="footer">Sent via the contact form at cascadeapartment3.com.au</div>
</div>
</body>
</html>`;

  // ─── Auto-reply to sender ─────────────────────────────────────────────────

  const replyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background: #faf8f4; font-family: Inter, Arial, sans-serif; color: #1a1a1a; }
    .wrap { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #0f2744; padding: 32px 40px; text-align: center; }
    .header-logo { color: #c9a84c; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
    .header-sub  { color: #8aa3c1; font-size: 13px; margin-top: 4px; }
    .body  { padding: 40px; }
    .body p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .info-box { border-left: 3px solid #c9a84c; padding: 16px 20px; background: #fdf8ee;
                border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 14px; line-height: 1.6; }
    .detail-card { background: #f5f3ef; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }
    .detail-card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
                      color: #6b7280; margin: 0 0 12px; }
    .detail-row { display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid #e5e0d8; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #6b7280; min-width: 70px; flex-shrink: 0; }
    .detail-value { font-weight: 600; word-break: break-word; }
    .footer { background: #f5f3ef; padding: 24px 40px; text-align: center;
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
  <div class="body">
    <p>Hi ${escHtml(name)},</p>
    <p>Thanks for reaching out! We've received your message and will get back to you within <strong>24–48 hours</strong>.</p>
    <div class="detail-card">
      <h2>Your Enquiry</h2>
      <div class="detail-row"><span class="detail-label">Subject</span><span class="detail-value">${escHtml(subject)}</span></div>
      <div class="detail-row"><span class="detail-label">Message</span><span class="detail-value" style="white-space:pre-wrap;">${escHtml(message)}</span></div>
    </div>
    <div class="info-box">
      In the meantime, you can check availability and rates on our website, or browse the apartment details and gallery. We look forward to helping you plan your alpine escape!
    </div>
    <p>Warm regards,<br><strong>The Cascade Apartment 3 Team</strong></p>
  </div>
  <div class="footer">
    <p><strong>Cascade Apartment 3</strong><br>
    Baw Baw Village, Mt Baw Baw VIC 3833<br>
    <a href="mailto:hello@mtbawbawcascade3.com">hello@mtbawbawcascade3.com</a></p>
    <p style="margin-top:12px; color:#9ca3af; font-size:12px;">
      You're receiving this because you submitted a contact form at cascadeapartment3.com.au.
    </p>
  </div>
</div>
</body>
</html>`;

  // ─── Send both emails ─────────────────────────────────────────────────────

  try {
    await Promise.all([
      sendEmail({
        apiKey:   RESEND_API_KEY,
        from:     fromAddress,
        to:       CONTACT_DEST,
        replyTo:  email,
        subject:  `New enquiry: ${subject} — from ${name}`,
        html:     adminHtml,
      }),
      sendEmail({
        apiKey:   RESEND_API_KEY,
        from:     fromAddress,
        to:       email,
        subject:  `We received your message — Cascade Apartment 3`,
        html:     replyHtml,
      }),
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact email send failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to send message' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendEmail({ apiKey, from, to, replyTo, subject, html }) {
  const payload = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Resend error ${response.status}`);
  }
  return data;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
