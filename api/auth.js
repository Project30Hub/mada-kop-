// GET  /api/auth  -> safe configuration check (no secrets): which Supabase host and which keys are set
// POST /api/auth  { action: 'login', email, password }
//                 { action: 'register', full_name, phone, email, password, over18: true }
//                 { action: 'refresh', refresh_token }
// Returns the Supabase session + the user's role/membership so the front end can route members, drivers and staff.
const { anonClient, serviceClient, userClient, envOk, configStatus, send, str } = require('./_lib/supabase');
const { sendMail, staffEmails, siteUrl, welcomeEmail, newMemberStaffEmail } = require('./_lib/mail');

const EMAIL = /^[^ @]+@[^ @]+[.][^ @]+$/;
const PHONE = /^[+0-9 ()-]{7,20}$/;

async function sessionPayload(session) {
  const { data: profile } = await userClient(session.access_token)
    .from('profiles').select('role, member_status, full_name, phone')
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

    if (body.action === 'register') {
      if (!envOk(res, true)) return;
      if (body.website) return send(res, 200, { ok: true }); // honeypot field: real people leave it empty
      const email = str(body.email, 254).toLowerCase();
      const password = String(body.password || '');
      const fullName = str(body.full_name, 120);
      const phone = str(body.phone, 30);
      if (fullName.length < 2) return send(res, 400, { error: 'Please enter your full name' });
      if (!EMAIL.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
      if (!PHONE.test(phone)) return send(res, 400, { error: 'Enter a valid phone number' });
      if (password.length < 8 || password.length > 100) return send(res, 400, { error: 'Password must be at least 8 characters' });
      if (body.over18 !== true) return send(res, 400, { error: 'You must be 18 or older to join' });

      // Accounts start as role=member, status=pending. Nobody can order until staff approve them.
      const created = await serviceClient().auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName, phone, over18: true }
      });
      if (created.error) {
        const m = String(created.error.message || '').toLowerCase();
        if (m.includes('already')) return send(res, 409, { error: 'An account with this email already exists. Try signing in.' });
        console.error('register error:', created.error.message);
        return send(res, 400, { error: 'Could not create the account' });
      }

      // welcome email to the new member + heads-up to the club (awaited so the serverless function does not freeze first)
      const site = siteUrl(req);
      const staff = await staffEmails();
      const [emailStatus] = await Promise.all([
        sendMail({ to: email, ...welcomeEmail(fullName, site) }),
        staff.length ? sendMail({ to: staff, ...newMemberStaffEmail({ full_name: fullName, email, phone }, site) }) : Promise.resolve('skipped')
      ]);

      const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
      if (error || !data || !data.session) return send(res, 201, { ok: true, needs_login: true, email_status: emailStatus });
      const payload = await sessionPayload(data.session);
      payload.email_status = emailStatus;
      return send(res, 201, payload);
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
