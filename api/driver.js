// Driver API (drivers, plus staff/admin for testing).
//   GET   /api/driver  -> orders assigned to me (newest first)
//   PATCH /api/driver  -> { order_id, status: picked|out_for_delivery|delivered, note? }
// The database enforces that a driver can only touch orders assigned to them.
const { authenticate, send, fail, UUID, str } = require('./_lib/supabase');

module.exports = async (req, res) => {
  const ctx = await authenticate(req, res, ['driver', 'staff', 'admin']);
  if (!ctx) return;
  const { db, user } = ctx;
  const body = req.body || {};

  try {
    if (req.method === 'GET') {
      const { data, error } = await db.from('orders')
        .select('id, order_number, status, customer_name, customer_phone, address_line, city, zip, delivery_note, payment_method, payment_status, total, created_at, delivered_at, items:order_items(product_name, quantity)')
        .eq('driver_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (error) return fail(res, error);
      return send(res, 200, { orders: data });
    }

    if (req.method === 'PATCH') {
      if (!UUID.test(String(body.order_id || ''))) return send(res, 400, { error: 'Invalid order' });
      if (!['picked', 'out_for_delivery', 'delivered'].includes(body.status)) return send(res, 400, { error: 'Invalid status' });
      const { data, error } = await db.rpc('update_order_status', {
        p_order_id: body.order_id,
        p_status: body.status,
        p_note: str(body.note, 300) || null,
        p_driver_id: null
      });
      if (error) return fail(res, error);
      return send(res, 200, { order: data });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return fail(res, err);
  }
};
