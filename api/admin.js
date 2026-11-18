// Back-office API (staff + admin). One function, routed by ?resource= (keeps us under Vercel's 12-function Hobby limit).
//   stats | orders | members | products | settings | export | create-staff
// Every query runs as the signed-in user, so RLS + RPC role checks are the real gatekeepers;
// the isAdmin checks below are just friendlier errors.
const { authenticate, serviceClient, envOk, send, fail, UUID, str } = require('./_lib/supabase');
const { sendMail, siteUrl, approvedEmail } = require('./_lib/mail');

const STATUSES = ['new', 'confirmed', 'picked', 'out_for_delivery', 'delivered', 'cancelled'];
const OPEN = ['new', 'confirmed', 'picked', 'out_for_delivery'];
const ROLES = ['member', 'driver', 'staff', 'admin'];
const MEMBER_STATUSES = ['pending', 'active', 'suspended'];
const SETTING_KEYS = ['delivery_fee', 'club_open', 'points_per_rand', 'require_active_member'];
const EMAIL = /^[^ @]+@[^ @]+[.][^ @]+$/;
const ORDER_SELECT = '*, items:order_items(id, product_name, unit_price, quantity, line_total), driver:profiles!orders_driver_id_fkey(id, full_name, phone), events:order_events(to_status, note, created_at)';

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function cleanSearch(s) { return str(s, 60).replace(/[^a-zA-Z0-9 +@.-]/g, ''); }

function productFields(b, create) {
  const out = {};
  if (create || b.name !== undefined) {
    const v = str(b.name, 120);
    if (!v) return { error: 'Name is required' };
    out.name = v;
  }
  if (create || b.price !== undefined) {
    const v = num(b.price);
    if (v === null || v < 0 || v > 100000) return { error: 'Price must be a number of zero or more' };
    out.price = Math.round(v * 100) / 100;
  }
  if (create || b.stock !== undefined) {
    const v = Number.parseInt(b.stock, 10);
    if (!Number.isInteger(v) || v < 0 || v > 100000) return { error: 'Stock must be zero or more' };
    out.stock = v;
  }
  if (b.category !== undefined) out.category = str(b.category, 60) || null;
  if (b.description !== undefined) out.description = str(b.description, 1000) || null;
  if (b.sku !== undefined) out.sku = str(b.sku, 40) || null;
  if (b.image_url !== undefined) {
    const u = str(b.image_url, 500);
    if (u && !/^https:[/][/]/i.test(u)) return { error: 'Image URL must start with https://' };
    out.image_url = u || null;
  }
  if (b.is_active !== undefined) out.is_active = b.is_active === true;
  return { value: out };
}

function cleanSetting(key, v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (key === 'delivery_fee') { const n = num(v.amount); return n !== null && n >= 0 && n <= 1000 ? { amount: n } : null; }
  if (key === 'points_per_rand') { const n = num(v.rate); return n !== null && n >= 0 && n <= 10 ? { rate: n } : null; }
  if (key === 'club_open') return typeof v.open === 'boolean' ? { open: v.open } : null;
  if (key === 'require_active_member') return typeof v.enabled === 'boolean' ? { enabled: v.enabled } : null;
  return null;
}

module.exports = async (req, res) => {
  const ctx = await authenticate(req, res, ['staff', 'admin']);
  if (!ctx) return;
  const { db, profile, user } = ctx;
  const isAdmin = profile.role === 'admin';
  const q = req.query || {};
  const body = req.body || {};
  const method = req.method;

  try {
    switch (q.resource) {
      case 'stats': {
        if (method !== 'GET') break;
        const { data, error } = await db.rpc('admin_stats');
        if (error) return fail(res, error);
        return send(res, 200, data);
      }

      case 'orders': {
        if (method === 'GET') {
          const limit = Math.min(Math.max(Number.parseInt(q.limit, 10) || 100, 1), 300);
          let query = db.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(limit);
          if (STATUSES.includes(q.status)) query = query.eq('status', q.status);
          else if (q.status === 'open') query = query.in('status', OPEN);
          const s = cleanSearch(q.q);
          if (s) query = query.or('order_number.ilike.%' + s + '%,customer_name.ilike.%' + s + '%,customer_phone.ilike.%' + s + '%');
          const { data, error } = await query;
          if (error) return fail(res, error);
          return send(res, 200, { orders: data });
        }
        if (method === 'PATCH') {
          if (!UUID.test(String(body.order_id || ''))) return send(res, 400, { error: 'Invalid order' });
          const status = body.status ? String(body.status) : null;
          if (status && !STATUSES.includes(status)) return send(res, 400, { error: 'Invalid status' });
          if (body.driver_id && !UUID.test(String(body.driver_id))) return send(res, 400, { error: 'Invalid driver' });
          const { data, error } = await db.rpc('update_order_status', {
            p_order_id: body.order_id,
            p_status: status,
            p_note: str(body.note, 300) || null,
            p_driver_id: body.driver_id || null
          });
          if (error) return fail(res, error);
          return send(res, 200, { order: data });
        }
        break;
      }

      case 'members': {
        if (method === 'GET') {
          let query = db.from('profiles')
            .select('id, email, full_name, phone, role, member_status, points, created_at')
            .order('created_at', { ascending: false }).limit(300);
          if (MEMBER_STATUSES.includes(q.status)) query = query.eq('member_status', q.status);
          if (ROLES.includes(q.role)) query = query.eq('role', q.role);
          const s = cleanSearch(q.q);
          if (s) query = query.or('full_name.ilike.%' + s + '%,email.ilike.%' + s + '%,phone.ilike.%' + s + '%');
          const { data, error } = await query;
          if (error) return fail(res, error);
          return send(res, 200, { members: data });
        }
        if (method === 'PATCH') {
          if (!UUID.test(String(body.user_id || ''))) return send(res, 400, { error: 'Invalid member' });
          if (body.member_status && !MEMBER_STATUSES.includes(body.member_status)) return send(res, 400, { error: 'Invalid membership status' });
          if (body.role && !ROLES.includes(body.role)) return send(res, 400, { error: 'Invalid role' });
          if (body.role && !isAdmin) return send(res, 403, { error: 'Only admins can change roles' });
          const prev = await db.from('profiles').select('member_status').eq('id', body.user_id).maybeSingle();
          const { data, error } = await db.rpc('admin_update_member', {
            p_user_id: body.user_id,
            p_member_status: body.member_status || null,
            p_role: body.role || null
          });
          if (error) return fail(res, error);
          // tell the member when they are newly approved (not on every save)
          let emailStatus = 'skipped';
          if (body.member_status === 'active' && prev.data && prev.data.member_status !== 'active' && data && data.email) {
            emailStatus = await sendMail({ to: data.email, ...approvedEmail(data.full_name, siteUrl(req)) });
          }
          return send(res, 200, { member: data, email_status: emailStatus });
        }
        break;
      }

      case 'products': {
        if (method === 'GET') {
          const { data, error } = await db.from('products').select('*').order('category').order('name');
          if (error) return fail(res, error);
          return send(res, 200, { products: data });
        }
        if (method === 'POST') {
          const p = productFields(body, true);
          if (p.error) return send(res, 400, { error: p.error });
          const { data, error } = await db.from('products').insert(p.value).select().single();
          if (error) return fail(res, error);
          return send(res, 201, { product: data });
        }
        if (method === 'PATCH') {
          if (!UUID.test(String(body.id || ''))) return send(res, 400, { error: 'Invalid product' });
          const p = productFields(body, false);
          if (p.error) return send(res, 400, { error: p.error });
          if (Object.keys(p.value).length === 0) return send(res, 400, { error: 'Nothing to update' });
          const { data, error } = await db.from('products').update(p.value).eq('id', body.id).select().single();
          if (error) return fail(res, error);
          return send(res, 200, { product: data });
        }
        if (method === 'DELETE') {
          // soft delete: keeps order history intact
          if (!isAdmin) return send(res, 403, { error: 'Only admins can remove products' });
          if (!UUID.test(String(q.id || ''))) return send(res, 400, { error: 'Invalid product' });
          const { error } = await db.from('products').update({ is_active: false }).eq('id', q.id);
          if (error) return fail(res, error);
          return send(res, 200, { ok: true });
        }
        break;
      }

      case 'settings': {
        if (method === 'GET') {
          const { data, error } = await db.from('settings').select('key, value, updated_at');
          if (error) return fail(res, error);
          return send(res, 200, { settings: data });
        }
        if (method === 'PATCH') {
          if (!isAdmin) return send(res, 403, { error: 'Only admins can change settings' });
          if (!SETTING_KEYS.includes(body.key)) return send(res, 400, { error: 'Unknown setting' });
          const value = cleanSetting(body.key, body.value);
          if (!value) return send(res, 400, { error: 'Invalid value for this setting' });
          const { error } = await db.from('settings').upsert({ key: body.key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
          if (error) return fail(res, error);
          return send(res, 200, { ok: true });
        }
        break;
      }

      case 'export': {
        if (method !== 'GET') break;
        const cols = ['order_number', 'created_at', 'status', 'payment_method', 'payment_status', 'customer_name', 'customer_phone', 'address_line', 'city', 'subtotal', 'delivery_fee', 'total'];
        const { data, error } = await db.from('orders').select(cols.join(', ')).order('created_at', { ascending: false }).limit(5000);
        if (error) return fail(res, error);
        const NL = String.fromCharCode(10);
        const Q = String.fromCharCode(34);
        // quote every cell and neutralise spreadsheet formula injection (=, +, @, -)
        const cell = v => {
          let s = v == null ? '' : String(v);
          if (/^[=+@-]/.test(s)) s = String.fromCharCode(39) + s;
          return Q + s.split(Q).join(Q + Q) + Q;
        };
        const csv = [cols.join(',')].concat(data.map(r => cols.map(c => cell(r[c])).join(','))).join(NL);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=madakop-orders.csv');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(csv);
      }

      case 'create-staff': {
        // Creates a driver or staff login. Needs the service-role key, so it is admin-only.
        if (method !== 'POST') break;
        if (!isAdmin) return send(res, 403, { error: 'Only admins can create accounts' });
        if (!envOk(res, true)) return;
        const email = str(body.email, 254).toLowerCase();
        const password = String(body.password || '');
        const role = body.role === 'staff' ? 'staff' : 'driver';
        const fullName = str(body.full_name, 120);
        const phone = str(body.phone, 30);
        if (!EMAIL.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
        if (password.length < 10 || password.length > 100) return send(res, 400, { error: 'Password must be at least 10 characters' });

        const admin = serviceClient();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, phone } });
        if (created.error) return send(res, 400, { error: created.error.message });
        const newId = created.data.user.id;
        const upd = await admin.from('profiles').update({ role, member_status: 'active', full_name: fullName, phone }).eq('id', newId);
        if (upd.error) return fail(res, upd.error);
        await admin.from('audit_log').insert({ actor_id: user.id, action: 'create_' + role, entity: 'profile', entity_id: newId, details: { email } });
        return send(res, 201, { id: newId, email, role });
      }
    }
    return send(res, 404, { error: 'Unknown resource or method' });
  } catch (err) {
    return fail(res, err);
  }
};
