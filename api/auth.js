// GET  /api/auth  -> safe configuration check (no secrets): which Supabase host and which keys are set
// POST /api/auth  { action: 'login', email, password }  |  { action: 'refresh', refresh_token }
// Returns the Supabase session + the user's role so the front end can route members, drivers and staff.
const { anonClient, userClient, envOk, configStatus, send } = require('./_lib/supabase');

async function sessionPayload(session) {
  const { data: profile } = await userClient(session.access_token)
    .from('profiles').select('role, member_status, full_name')
    .eq('id', session.user.id).maybeSingle();
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: session.user.id, email: session.user.email },
    profile: profile || null
  };
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return send(res, 200, configStatus());
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!envOk(res, false)) return;
  const body = req.body || {};
  try {
    if (body.action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !password || email.length > 254 || password.length > 200) {
        return send(res, 400, { error: 'Email and password are required' });
      }
      const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
      // one generic message so attackers cannot tell which emails exist
      if (error || !data || !data.session) return send(res, 401, { error: 'Invalid email or password' });
      return send(res, 200, await sessionPayload(data.session));
    }
    if (body.action === 'refresh') {
      const token = String(body.refresh_token || '');
      if (!token) return send(res, 400, { error: 'Missing refresh token' });
      const { data, error } = await anonClient().auth.refreshSession({ refresh_token: token });
      if (error || !data || !data.session) return send(res, 401, { error: 'Session expired, please sign in again' });
      return send(res, 200, await sessionPayload(data.session));
    }
    return send(res, 400, { error: 'Unknown action' });
  } catch (err) {
    console.error('auth error:', err && err.message);
    return send(res, 500, { error: 'Something went wrong' });
  }
};
