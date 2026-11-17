// Shared helpers for the serverless API. (Files starting with _ are not deployed as routes.)
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NO_SESSION = { persistSession: false, autoRefreshToken: false };

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function envOk(res, needService) {
  if (!URL || !ANON || (needService && !SERVICE)) {
    send(res, 500, { error: 'Server is not configured yet (missing Supabase environment variables)' });
    return false;
  }
  return true;
}

function anonClient() { return createClient(URL, ANON, { auth: NO_SESSION }); }
function serviceClient() { return createClient(URL, SERVICE, { auth: NO_SESSION }); }
// Runs queries AS the signed-in user, so Row Level Security and the RPC role checks always apply.
function userClient(token) {
  return createClient(URL, ANON, { auth: NO_SESSION, global: { headers: { Authorization: 'Bearer ' + token } } });
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

module.exports = { send, envOk, anonClient, serviceClient, userClient, authenticate, fail, UUID, str };
