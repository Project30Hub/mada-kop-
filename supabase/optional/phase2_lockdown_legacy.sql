-- =====================================================================
-- PHASE 2 (OPTIONAL, DO NOT RUN YET) - lock down the LEGACY tables
-- =====================================================================
-- The original order.html / admin.html / driver.html talk to delivery_orders and drivers
-- with the public anon key, and SETUP.md documents a policy that lets ANYONE read, edit and
-- delete every order, plus a drivers table with plaintext passwords.
--
-- Running this file closes that hole, but the OLD pages will stop working (they use anon access).
-- Run it only after the storefront has moved to POST /api/orders and the team uses back-office.html.

drop policy if exists public_delivery_orders on public.delivery_orders;

create policy legacy_orders_staff_only on public.delivery_orders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- plaintext driver passwords must not be reachable from the browser at all
revoke all on public.drivers from anon, authenticated;
