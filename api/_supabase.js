/**
 * Supabase REST API helper for Cascade Apartment 3
 *
 * Uses Supabase's PostgREST endpoint — no npm packages needed, just fetch().
 *
 * Required env vars (set in Vercel dashboard):
 *   SUPABASE_URL              — e.g. https://abcxyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key from Supabase project settings
 *
 * SQL to run in Supabase SQL Editor to create required tables:
 * ─────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS ca3_settings (
 *   key        TEXT PRIMARY KEY,
 *   value      JSONB NOT NULL,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS ca3_bookings (
 *   id          TEXT PRIMARY KEY,
 *   guest_name  TEXT NOT NULL,
 *   guest_email TEXT,
 *   guest_phone TEXT,
 *   check_in    DATE NOT NULL,
 *   check_out   DATE NOT NULL,
 *   guests      INTEGER DEFAULT 1,
 *   status      TEXT DEFAULT 'confirmed',
 *   total       NUMERIC(10,2) DEFAULT 0,
 *   notes       TEXT,
 *   source      TEXT DEFAULT 'direct',
 *   created_at  TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at  TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS ca3_blocked_dates (
 *   id         TEXT PRIMARY KEY,
 *   start_date DATE NOT NULL,
 *   end_date   DATE NOT NULL,
 *   reason     TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS ca3_ical_connections (
 *   id          TEXT PRIMARY KEY,
 *   name        TEXT NOT NULL,
 *   url         TEXT NOT NULL,
 *   platform    TEXT,
 *   direction   TEXT DEFAULT 'import',
 *   last_sync   TIMESTAMPTZ,
 *   created_at  TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Disable RLS (service role key bypasses it anyway, but avoids confusion)
 * ALTER TABLE ca3_settings         DISABLE ROW LEVEL SECURITY;
 * ALTER TABLE ca3_bookings         DISABLE ROW LEVEL SECURITY;
 * ALTER TABLE ca3_blocked_dates    DISABLE ROW LEVEL SECURITY;
 * ALTER TABLE ca3_ical_connections DISABLE ROW LEVEL SECURITY;
 */

export function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function base() { return (process.env.SUPABASE_URL || '').replace(/\/$/, ''); }
function key()  { return process.env.SUPABASE_SERVICE_ROLE_KEY || ''; }

function authHeaders(extra = {}) {
  return {
    'apikey': key(),
    'Authorization': `Bearer ${key()}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** SELECT rows. params is a PostgREST query string, e.g. 'select=*&status=eq.confirmed' */
export async function sbSelect(table, params = 'select=*') {
  const r = await fetch(`${base()}/rest/v1/${table}?${params}`, {
    headers: authHeaders(),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase SELECT ${r.status}: ${text}`);
  }
  return r.json(); // returns array
}

/** INSERT one or more rows. Returns inserted rows. */
export async function sbInsert(table, data) {
  const r = await fetch(`${base()}/rest/v1/${table}`, {
    method: 'POST',
    headers: authHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase INSERT ${r.status}: ${text}`);
  }
  return r.json(); // array
}

/** UPSERT — insert or update on conflict for given column. */
export async function sbUpsert(table, data, onConflict = 'id') {
  const r = await fetch(`${base()}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: authHeaders({ 'Prefer': 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase UPSERT ${r.status}: ${text}`);
  }
  return r.json();
}

/** UPDATE rows matching filter. filter e.g. { id: 'abc123' } */
export async function sbUpdate(table, filter, changes) {
  const qs = Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const r = await fetch(`${base()}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(changes),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase UPDATE ${r.status}: ${text}`);
  }
  return r.json();
}

/**
 * Check whether a date range conflicts with any existing confirmed/pending booking.
 *
 * A new booking [checkIn, checkOut) conflicts with an existing booking [ci, co) when:
 *   ci < checkOut  AND  co > checkIn
 *
 * Back-to-back is intentionally allowed: if an existing booking checks out on the
 * same day a new booking checks in, co == checkIn so `co > checkIn` is FALSE — no
 * conflict is reported and the same-day turnover proceeds normally.
 *
 * @param {string} checkIn   — ISO date string, e.g. '2025-12-20'
 * @param {string} checkOut  — ISO date string, e.g. '2025-12-24'
 * @param {string} [excludeId] — booking ID to ignore (useful when updating an existing booking)
 * @returns {Promise<string|null>} — null if available, or the conflicting booking's id
 */
export async function sbCheckDateConflict(checkIn, checkOut, excludeId) {
  if (!isConfigured()) return null; // DB not configured — skip check

  // PostgREST filter: find non-cancelled bookings whose range overlaps [checkIn, checkOut)
  const params = [
    'select=id',
    'status=neq.cancelled',
    `check_in=lt.${checkOut}`,
    `check_out=gt.${checkIn}`,
  ];
  if (excludeId) params.push(`id=neq.${encodeURIComponent(excludeId)}`);

  const rows = await sbSelect('ca3_bookings', params.join('&'));
  return rows.length > 0 ? rows[0].id : null;
}

/** DELETE rows matching filter. filter e.g. { id: 'abc123' } */
export async function sbDelete(table, filter) {
  const qs = Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const r = await fetch(`${base()}/rest/v1/${table}?${qs}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase DELETE ${r.status}: ${text}`);
  }
}
