/**
 * Vercel Serverless Function — /api/email-detail
 *
 * Retrieves full details (HTML body, reply_to) of a single sent email from Resend.
 * Called by the admin Emails page when viewing a specific enquiry.
 *
 * Query param: ?id=<resend_email_id>
 *
 * Required environment variable: RESEND_API_KEY
 */

const RESEND_API = 'https://api.resend.com';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing email id parameter' });
  }

  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email service not configured', code: 'not_configured' });
  }

  try {
    const response = await fetch(`${RESEND_API}/emails/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Resend API error ${response.status}`);
    }

    const email = await response.json();

    // Extract reply_to — Resend returns it as an array
    const replyTo = Array.isArray(email.reply_to)
      ? email.reply_to[0] || ''
      : email.reply_to || '';

    return res.status(200).json({
      id:         email.id,
      html:       email.html || '',
      text:       email.text || '',
      replyTo,
      subject:    email.subject || '',
      createdAt:  email.created_at,
      status:     email.last_event || 'sent',
    });

  } catch (err) {
    console.error('email detail fetch failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to retrieve email' });
  }
}
