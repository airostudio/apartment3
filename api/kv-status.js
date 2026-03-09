/**
 * /api/kv-status — Database connection diagnostic
 *
 * Scans all env vars for anything database/postgres related,
 * reports what names Vercel is actually using, and pings the DB.
 */

const DB_KEYWORDS = ['POSTGRES', 'DATABASE_URL', 'PG', 'NEON', 'SUPABASE', 'KV'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Scan all env vars for anything DB-related (mask values)
  const dbVars = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (DB_KEYWORDS.some(kw => key.toUpperCase().includes(kw))) {
      dbVars[key] = val ? `[set, length=${val.length}]` : '[empty]';
    }
  }

  // Try to find a usable connection string
  const connStr =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    findEnvContaining('POSTGRES_URL_NON_POOLING') ||
    findEnvContaining('POSTGRES_URL') ||
    null;

  const configured = !!connStr;
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
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      pingResult = { httpStatus: r.status, response: data };
    } catch (e) {
      pingResult = { error: e.message };
    }
  }

  return res.status(200).json({
    configured,
    dbVarsFound: Object.keys(dbVars).length,
    dbVars,
    connStrSource: connStr ? detectSource(connStr) : null,
    host: connStr ? (() => { try { return new URL(connStr).hostname; } catch { return null; } })() : null,
    pingResult,
  });
}

function findEnvContaining(fragment) {
  for (const [key, val] of Object.entries(process.env)) {
    if (key !== fragment && key.includes(fragment) && val) return val;
  }
  return null;
}

function detectSource(connStr) {
  if (process.env.POSTGRES_URL_NON_POOLING === connStr) return 'POSTGRES_URL_NON_POOLING';
  if (process.env.POSTGRES_URL === connStr) return 'POSTGRES_URL';
  if (process.env.DATABASE_URL === connStr) return 'DATABASE_URL';
  return 'prefixed var';
}
