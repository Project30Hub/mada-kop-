// Shared helpers for the serverless API. (Files starting with _ are not deployed as routes.)
const { createClient } = require('@supabase/supabase-js');

// Tolerates common copy/paste mistakes: quotes, spaces, missing https://, a path on the end, or just the project ref.
function cleanUrl(raw) {
  let s = String(raw || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!s) return '';
  if (/^[a-z]{20}$/.test(s)) return 'https://' + s + '.supabase.co';
  if (!/^https?:[/][/]/i.test(s)) s = 'https://' + s;
  const m = s.match(/^https?:[/][/][^/]+/i);
  return m ? m[0] : s;
}
function cleanKey(raw) { return String(raw || '').trim().replace(/^['"]+|['"]+$/g, ''); }

const SB_URL = cleanUrl(process.env.SUPABASE_URL);
const ANON = cleanKey(process.env.SUPABASE_ANON_KEY);
const SERVICE = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
const NO_SESSION = { persistSession: false, autoRefreshToken: false };

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function envOk(res, needService) {
  if (!SB_URL || !ANON || (needService && !SERVICE)) {
    send(res, 500, { error: 'Server is not configured yet (missing Supabase environment variables)' });
    return false;
  }
  return true;
}

// Safe summary for debugging setup problems: never returns any key material.
function configStatus() {
  let host = null;
  try { host = new globalThis.URL(SB_URL).hostname; } catch (e) { host = null; }
  return { supabase_host: host, has_anon_key: !!ANON, has_service_key: !!SERVICE };
}

function anonClient() { return createClient(SB_URL, ANON, { auth: NO_SESSION }); }
function serviceClient() { return createClient(SB_URL, SERVICE, { auth: NO_SESSION }); }
// Runs queries AS the signed-in user, so Row Level Security and the RPC role checks always apply.
function userClient(token) {
  return createClient(SB_URL, ANON, { auth: NO_SESSION, global: { headers: { Authorization: 'Bearer ' + token } } });
}

// Verifies the bearer token, loads the profile, and (optionally) enforces a role list.
// Returns null after sending the error response if the request should stop.
async function authenticate(req, res, allowedRoles) {
  if (!envOk(res, false)) return null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { send(res, 401, { error: 'Please sign in' }); return null; }

  const db = userClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) { send(res, 401, { error: 'Session expired, please sign in again' }); return null; }

  const { data: profile } = await db.from('profiles')
    .select('id, role, member_status, full_name, phone')
    .eq('id', data.user.id).maybeSingle();
  if (!profile) { send(res, 403, { error: 'No profile found for this account' }); return null; }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    send(res, 403, { error: 'You do not have access to this area' });
    return null;
  }
  return { db, user: data.user, profile, token };
}

// Maps database errors to safe HTTP responses (RPC business-rule messages are meant for humans).
function fail(res, err) {
  const code = err && err.code;
  const msg = (err && err.message) || 'Unexpected error';
  if (code === '28000') return send(res, 401, { error: msg });
  if (code === '42501') return send(res, 403, { error: msg });
  if (code === 'P0001') return send(res, 400, { error: msg });
  if (code === '23505') return send(res, 409, { error: 'That already exists' });
  if (code === '23514' || code === '22P02' || code === '23503') return send(res, 400, { error: 'Some of the values are not valid' });
  console.error('API error:', err);
  return send(res, 500, { error: 'Something went wrong' });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }

module.exports = { send, envOk, configStatus, anonClient, serviceClient, userClient, authenticate, fail, UUID, str };
