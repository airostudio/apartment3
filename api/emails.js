/**
 * Vercel Serverless Function — /api/emails
 *
 * Lists contact enquiries by pulling sent emails from the Resend API.
 * Filters to admin notification emails (sent to the ADMIN_EMAIL / CONTACT_DEST address,
 * subject starting with "New enquiry from").
 *
 * Required environment variables (already set for the contact form):
 *   RESEND_API_KEY   — your Resend API key
 *   ADMIN_EMAIL      — the admin notification address (e.g. hello@mtbawbawcascade3.com)
 *                      falls back to EMAIL_FROM if not set
 */

const RESEND_API    = 'https://api.resend.com';
const CONTACT_DEST  = 'hello@mtbawbawcascade3.com';
// Matches subject format: "New enquiry from Name <email>: Subject"
const SUBJECT_RE    = /^New enquiry from (.+?) <([^>]+)>: (.+)$/;

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

  const { RESEND_API_KEY, ADMIN_EMAIL, EMAIL_FROM } = process.env;
  const adminEmail = ADMIN_EMAIL || EMAIL_FROM || CONTACT_DEST;

  if (!RESEND_API_KEY) {
    return res.status(503).json({
      error: 'Email service not configured',
      code:  'not_configured',
    });
  }

  try {
    // Fetch up to 100 most-recent sent emails from Resend
    const response = await fetch(`${RESEND_API}/emails?limit=100`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Resend API error ${response.status}`);
    }

    const data = await response.json();
    // Resend returns { data: [ ...emails ] }
    const all = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

    // Filter to admin contact-form notifications only
    const contacts = all
      .filter(email => {
        const toAddresses = Array.isArray(email.to) ? email.to : [email.to];
        const isToAdmin   = toAddresses.some(a => String(a).toLowerCase().includes(adminEmail.toLowerCase().split('<').pop().replace('>', '').trim()));
        const isEnquiry   = SUBJECT_RE.test(email.subject || '');
        return isToAdmin && isEnquiry;
      })
      .map(email => {
        const match   = SUBJECT_RE.exec(email.subject || '');
        const name    = match ? match[1] : 'Unknown';
        const visitor = match ? match[2] : '';
        const subject = match ? match[3] : email.subject || '';
        return {
          id:          email.id,
          name,
          email:       visitor,
          subject,
          receivedAt:  email.created_at,
          status:      email.last_event || 'sent',
        };
      });

    return res.status(200).json({ contacts, total: contacts.length });

  } catch (err) {
    console.error('emails list failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to retrieve emails' });
  }
}
