/**
 * POST /api/admin-logout
 * Clears the session cookies.
 */

const CLEAR = 'HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    `ca3_session=; ${CLEAR}`,
    `ca3_role=; Secure; SameSite=Lax; Max-Age=0; Path=/`,
  ]);
  return res.status(200).json({ success: true });
}
