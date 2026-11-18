// Member-facing orders API (any signed-in user).
//   GET   /api/orders?resource=me    -> my profile (name, phone, membership status, points)
//   GET   /api/orders?resource=menu  -> active products + delivery fee + club open flag
//   GET   /api/orders                -> my orders (with items + timeline)
//   POST  /api/orders                -> place an order  { items:[{product_id, quantity}], customer_name, customer_phone, address_line, city, zip?, note?, payment_method? }
//   PATCH /api/orders                -> cancel my order (only while status is new)  { order_id }
const { authenticate, send, fail, UUID, str } = require('./_lib/supabase');

const ORDER_SELECT = '*, items:order_items(id, product_name, unit_price, quantity, line_total), events:order_events(to_status, note, created_at)';
const PHONE = /^[+0-9 ()-]{7,20}$/;

module.exports = async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  const { db, user } = ctx;
  const q = req.query || {};
  const body = req.body || {};

  try {
    if (req.method === 'GET' && q.resource === 'me') {
      const { data, error } = await db.from('profiles')
        .select('full_name, phone, member_status, points, address_line, city, zip, role')
        .eq('id', user.id).maybeSingle();
      if (error) return fail(res, error);
      return send(res, 200, { profile: data });
    }

    if (req.method === 'GET' && q.resource === 'menu') {
      const [products, settings] = await Promise.all([
        db.from('products').select('id, sku, name, category, description, price, stock, image_url').eq('is_active', true).gt('stock', 0).order('category').order('name'),
        db.from('settings').select('key, value').in('key', ['delivery_fee', 'club_open'])
      ]);
      if (products.error) return fail(res, products.error);
      if (settings.error) return fail(res, settings.error);
      const s = {};
      (settings.data || []).forEach(r => { s[r.key] = r.value; });
      return send(res, 200, { products: products.data, delivery_fee: (s.delivery_fee || {}).amount || 0, club_open: (s.club_open || {}).open !== false });
    }

    if (req.method === 'GET') {
      const { data, error } = await db.from('orders').select(ORDER_SELECT)
        .eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) return fail(res, error);
      return send(res, 200, { orders: data });
    }

    if (req.method === 'POST') {
      const raw = Array.isArray(body.items) ? body.items : [];
      if (raw.length === 0 || raw.length > 50) return send(res, 400, { error: 'Your cart is empty' });
      const items = raw.map(i => ({ product_id: String((i && i.product_id) || ''), quantity: Number.parseInt(i && i.quantity, 10) }));
      if (items.some(i => !UUID.test(i.product_id) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 20)) {
        return send(res, 400, { error: 'One of the cart items is invalid' });
      }
      const phone = str(body.customer_phone, 30);
      if (!PHONE.test(phone)) return send(res, 400, { error: 'Please enter a valid phone number' });
      const name = str(body.customer_name, 120);
      const address = str(body.address_line, 200);
      const city = str(body.city, 80);
      if (!name || !address || !city) return send(res, 400, { error: 'Name, address and city are required' });
      const payment = ['cod', 'eft', 'payfast'].includes(body.payment_method) ? body.payment_method : 'cod';

      const { data, error } = await db.rpc('place_order', {
        p_items: items,
        p_customer_name: name,
        p_customer_phone: phone,
        p_address_line: address,
        p_city: city,
        p_zip: str(body.zip, 12) || null,
        p_note: str(body.note, 500) || null,
        p_payment_method: payment
      });
      if (error) return fail(res, error);

      const full = await db.from('orders').select(ORDER_SELECT).eq('id', data.id).maybeSingle();
      return send(res, 201, { order: full.data || data });
    }

    if (req.method === 'PATCH') {
      if (!UUID.test(String(body.order_id || ''))) return send(res, 400, { error: 'Invalid order' });
      const { data, error } = await db.rpc('cancel_my_order', { p_order_id: body.order_id });
      if (error) return fail(res, error);
      return send(res, 200, { order: data });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return fail(res, err);
  }
};
