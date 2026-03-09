/**
 * /api/kv-status — Database connection diagnostic
 *
 * Returns safe diagnostic info about Postgres connectivity.
 * Connection string is masked; only presence and connectivity are shown.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const connStr = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || null;
  const configured = !!connStr;

  // Show which relevant env vars are present (masked)
  const envVars = {};
  for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_HOST', 'POSTGRES_DATABASE', 'POSTGRES_USER']) {
    const val = process.env[key];
    if (val) envVars[key] = `[set, length=${val.length}]`;
  }

  let pingResult = null;
  if (configured) {
    try {
      const u = new URL(connStr);
      const host = u.hostname;
      const password = decodeURIComponent(u.password);

      const r = await fetch(`https://${host}/sql`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${password}`,
          'Content-Type': 'application/json',
          'Neon-Connection-String': connStr,
        },
        body: JSON.stringify({ query: 'SELECT 1 AS ok', params: [] }),
      });
      const data = await r.json();
      pingResult = { httpStatus: r.status, rows: data.rows };
    } catch (e) {
      pingResult = { error: e.message };
    }
  }

  return res.status(200).json({
    configured,
    envVars,
    host: connStr ? new URL(connStr).hostname : null,
    pingResult,
  });
}
