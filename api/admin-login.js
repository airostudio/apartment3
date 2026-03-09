/**
 * POST /api/admin-login
 * Body: { email, password }
 *
 * Verifies credentials against ADMIN_PASSWORD / OWNER_PASSWORD env vars,
 * then sets an HttpOnly signed session cookie (ca3_session) + a readable
 * role cookie (ca3_role) used by the client-side page guard.
 *
 * Required env vars:
 *   ADMIN_PASSWORD   — password for hello@mtbawbawcascade3.com
 *   OWNER_PASSWORD   — password for typhoon.tall69@gmail.com
 *   SESSION_SECRET   — random string used to sign session tokens
 */

import { makeToken } from './_auth.js';

const ACCOUNTS = {
  'hello@mtbawbawcascade3.com': {
    envVar:   'ADMIN_PASSWORD',
    role:     'admin',
    name:     'Admin',
    initials: 'AD',
  },
  'typhoon.tall69@gmail.com': {
    envVar:   'OWNER_PASSWORD',
    role:     'owner',
    name:     'Property Owner',
    initials: 'PO',
  },
};

const COOKIE_OPTS = 'Secure; SameSite=Lax; Max-Age=604800; Path=/'; // 7 days

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'same-origin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email = '', password = '' } = req.body || {};
  const key     = email.toLowerCase().trim();
  const account = ACCOUNTS[key];

  // Unknown email or missing env var
  if (!account) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const expectedPassword = process.env[account.envVar];

  // Env var not configured — fall back to dev mode warning
  if (!expectedPassword) {
    console.warn(`[admin-login] ${account.envVar} is not set`);
    return res.status(503).json({
      success: false,
      error:   `Server misconfigured: ${account.envVar} env var is missing`,
    });
  }

  if (password !== expectedPassword) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = makeToken(account.role, key);

  res.setHeader('Set-Cookie', [
    // HttpOnly — real auth token, JS cannot read or forge
    `ca3_session=${token}; HttpOnly; ${COOKIE_OPTS}`,
    // Readable — lets client JS know the role without exposing the token
    `ca3_role=${account.role}; ${COOKIE_OPTS}`,
  ]);

  return res.status(200).json({
    success:  true,
    role:     account.role,
    name:     account.name,
    initials: account.initials,
  });
}
