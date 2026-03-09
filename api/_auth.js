/**
 * Shared server-side session verification for admin API endpoints.
 *
 * Session token format (base64url-encoded):
 *   "<role>:<email>:<expiry_ms>.<hmac-sha256-hex>"
 *
 * Required env var: SESSION_SECRET
 */

import { createHmac } from 'node:crypto';

const SECRET = () => process.env.SESSION_SECRET || 'dev-secret-change-in-prod';

/**
 * Parse and verify the ca3_session cookie from a request.
 * Returns { role, email } on success, or null if invalid/expired/missing.
 */
export function verifySession(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/ca3_session=([^;]+)/);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64url').toString('utf8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;
    const payload = decoded.slice(0, lastDot);
    const sig     = decoded.slice(lastDot + 1);
    const expected = createHmac('sha256', SECRET()).update(payload).digest('hex');
    if (sig !== expected) return null;
    const parts = payload.split(':');
    if (parts.length < 3) return null;
    const [role, email, expiry] = parts;
    if (Date.now() > parseInt(expiry, 10)) return null;
    return { role, email };
  } catch {
    return null;
  }
}

/**
 * Build a signed session token.
 */
export function makeToken(role, email) {
  const expiry  = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `${role}:${email}:${expiry}`;
  const sig     = createHmac('sha256', SECRET()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

/**
 * Convenience: send a 401 response if session is missing/invalid.
 * Returns the session object if valid, null if response was already sent.
 */
export function requireSession(req, res) {
  const session = verifySession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return session;
}
