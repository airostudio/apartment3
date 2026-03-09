/**
 * GET /api/admin-check
 * Returns 200 + { authenticated, role, email } if session cookie is valid,
 * or 401 + { authenticated: false } if not.
 *
 * Used by the client-side page guard in auth.js as a fallback when the
 * readable ca3_role cookie is absent (e.g. after a browser restart clears
 * session cookies but not persistent ones, or vice-versa).
 */

import { verifySession } from './_auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const session = verifySession(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, role: session.role, email: session.email });
}
