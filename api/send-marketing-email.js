/**
 * Vercel Serverless Function — /api/send-marketing-email
 *
 * Sends a marketing/campaign email to a list of recipients via Resend.
 *
 * POST body:
 *   recipients  string[]  — list of email addresses
 *   subject     string    — email subject
 *   html        string    — full HTML body
 *
 * Required env vars: RESEND_API_KEY, EMAIL_FROM
 */

const RESEND_API = 'https://api.resend.com/emails';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { recipients, subject, html } = body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'recipients array is required' });
  }
  if (!subject || !html) {
    return res.status(400).json({ error: 'subject and html are required' });
  }
  if (recipients.length > 200) {
    return res.status(400).json({ error: 'Maximum 200 recipients per send' });
  }

  const from = EMAIL_FROM || 'Cascade Apartment 3 <onboarding@resend.dev>';
  const results = { sent: 0, failed: 0, errors: [] };

  for (const recipient of recipients) {
    try {
      const r = await fetch(RESEND_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: recipient, subject, html }),
      });
      const data = await r.json();
      if (!r.ok) {
        results.failed++;
        results.errors.push({ to: recipient, error: data.message || `Resend error ${r.status}` });
      } else {
        results.sent++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ to: recipient, error: err.message });
    }
  }

  return res.status(200).json({ success: true, total: recipients.length, ...results });
}
