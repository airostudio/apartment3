/**
 * /api/kv-status — KV connection diagnostic
 *
 * Returns safe diagnostic info about KV env vars and connectivity.
 * Values are masked; only presence and connectivity status are shown.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Scan for any Vercel KV-related env vars (handles custom store names)
  const kvVars = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (key.includes('KV_REST_API') || key === 'KV_URL') {
      kvVars[key] = val ? `[set, length=${val.length}]` : '[empty]';
    }
  }

  // Determine which URL/token to use (standard or prefixed)
  const url   = process.env.KV_REST_API_URL   || findEnv('KV_REST_API_URL');
  const token = process.env.KV_REST_API_TOKEN  || findEnv('KV_REST_API_TOKEN');

  const configured = !!(url && token);
  let pingResult = null;

  if (configured) {
    try {
      const r = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([['PING']]),
      });
      const data = await r.json();
      pingResult = {
        httpStatus: r.status,
        response: data,
      };
    } catch (e) {
      pingResult = { error: e.message };
    }
  }

  return res.status(200).json({
    configured,
    kvVars,
    url: url ? `${url.slice(0, 30)}...` : null,
    pingResult,
  });
}

function findEnv(suffix) {
  for (const [key, val] of Object.entries(process.env)) {
    if (key.endsWith('_' + suffix)) return val;
  }
  return null;
}
