-- =====================================================================
-- PHASE 2 (OPTIONAL, DO NOT RUN YET) - lock down the LEGACY tables
-- =====================================================================
-- On the live database, delivery_orders has a policy that lets ANY signed-in user read, edit and
-- delete every legacy order. Once members can sign up (v2), that means every member. The legacy
-- drivers table also stores plaintext passwords.
--
-- Running this closes that hole, but the OLD pages (order.html / admin.html / driver.html) will
-- stop working. Run it only after the storefront uses POST /api/orders and the team uses back-office.html.

drop policy if exists "Allow authenticated users to manage orders" on public.delivery_orders;
drop policy if exists public_delivery_orders on public.delivery_orders;

create policy legacy_orders_staff_only on public.delivery_orders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- plaintext driver passwords must not be reachable from the browser at all
revoke all on public.drivers from anon, authenticated;

-- NOTE: the database also has legacy tables named members and points_log. Review their policies
-- before launch so signed-in members cannot read each other's data.
