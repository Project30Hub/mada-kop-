-- =====================================================================
-- MadaKop backend v2  (ADDITIVE: legacy delivery_orders + drivers are NOT touched)
-- Safe to re-run. Run in the Supabase SQL Editor once the project is active.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('member','driver','staff','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('new','confirmed','picked','out_for_delivery','delivered','cancelled'); exception when duplicate_object then null; end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 1. PROFILES (one row per auth user; holds role + membership state)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role public.app_role not null default 'member',
  member_status text not null default 'pending' check (member_status in ('pending','active','suspended')),
  points integer not null default 0 check (points >= 0),
  address_line text,
  city text,
  zip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(member_status);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- role helpers (SECURITY DEFINER so RLS policies can call them without recursion)
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('staff','admin') from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- auto-create a profile whenever someone signs up (always role=member, status=pending)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- backfill profiles for users that already exist
insert into public.profiles (id, email)
select id, email from auth.users on conflict (id) do nothing;

-- privilege-escalation guard: a signed-in non-admin can never change role/points/status directly.
-- (SECURITY DEFINER RPCs and the SQL editor run as a different DB role, so they are unaffected.)
create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.role := old.role;
    new.points := old.points;
    new.member_status := old.member_status;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------
-- 2. SETTINGS (back-office controlled)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('delivery_fee', jsonb_build_object('amount', 0)),
  ('club_open', jsonb_build_object('open', true)),
  ('points_per_rand', jsonb_build_object('rate', 0.1)),
  ('require_active_member', jsonb_build_object('enabled', true))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3. PRODUCTS (inventory)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null check (char_length(name) between 1 and 120),
  category text,
  description text,
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_active_idx on public.products(is_active, category);
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. ORDERS (+ items, timeline, loyalty ledger, audit log)
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('MK' || nextval('public.order_number_seq')::text),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address_line text not null,
  city text not null,
  zip text,
  delivery_note text,
  payment_method text not null default 'cod' check (payment_method in ('cod','eft','payfast')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  status public.order_status not null default 'new',
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  driver_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_driver_idx on public.orders(driver_id, status);
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) generated always as (unit_price * quantity) stored
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.order_events (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid,
  to_status public.order_status,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at);

create table if not exists public.points_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_user_idx on public.points_ledger(user_id, created_at desc);

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.points_ledger enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.settings, public.products, public.orders, public.order_items,
  public.order_events, public.points_ledger, public.audit_log from anon;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- settings: delivery fee + open/closed are public to signed-in users; everything else staff only
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (key in ('delivery_fee','club_open') or public.is_staff());
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- products: signed-in users see active items; staff manage; only admin deletes
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated using (is_active or public.is_staff());
drop policy if exists products_staff_insert on public.products;
create policy products_staff_insert on public.products for insert to authenticated with check (public.is_staff());
drop policy if exists products_staff_update on public.products;
create policy products_staff_update on public.products for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

-- orders and children: READ-ONLY from the client. All writes go through the RPCs below.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid() or public.is_staff());
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
drop policy if exists order_events_select on public.order_events;
create policy order_events_select on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
drop policy if exists points_select on public.points_ledger;
create policy points_select on public.points_ledger for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists audit_admin_select on public.audit_log;
create policy audit_admin_select on public.audit_log for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.orders, public.order_items, public.order_events, public.points_ledger, public.audit_log from authenticated;

-- ---------------------------------------------------------------------
-- 6. RPCs (business rules live in the database, so they cannot be bypassed)
-- ---------------------------------------------------------------------

-- Place an order. Prices, stock and totals are computed HERE - the client cannot tamper with them.
create or replace function public.place_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_address_line text,
  p_city text,
  p_zip text default null,
  p_note text default null,
  p_payment_method text default 'cod'
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_order public.orders;
  v_item jsonb;
  v_prod public.products;
  v_qty integer;
  v_subtotal numeric(10,2) := 0;
  v_fee numeric(10,2) := 0;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'No profile found' using errcode = '42501'; end if;

  if not coalesce((select (value->>'open')::boolean from public.settings where key = 'club_open'), true) then
    raise exception 'The club is not taking orders right now';
  end if;
  if coalesce((select (value->>'enabled')::boolean from public.settings where key = 'require_active_member'), true)
     and v_profile.member_status <> 'active' then
    raise exception 'Your membership is not active yet';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Too many items in one order'; end if;
  if p_payment_method not in ('cod','eft','payfast') then raise exception 'Invalid payment method'; end if;
  if coalesce(trim(p_customer_name),'') = '' or coalesce(trim(p_customer_phone),'') = ''
     or coalesce(trim(p_address_line),'') = '' or coalesce(trim(p_city),'') = '' then
    raise exception 'Name, phone and delivery address are required';
  end if;

  select coalesce((value->>'amount')::numeric, 0) into v_fee from public.settings where key = 'delivery_fee';
  v_fee := coalesce(v_fee, 0);

  insert into public.orders (customer_id, customer_name, customer_phone, customer_email, address_line, city, zip, delivery_note, payment_method, delivery_fee)
  values (v_uid, left(trim(p_customer_name), 120), left(trim(p_customer_phone), 30), v_profile.email,
          left(trim(p_address_line), 200), left(trim(p_city), 80), left(p_zip, 12), left(p_note, 500), p_payment_method, v_fee)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Invalid quantity'; end if;
    select * into v_prod from public.products where id = (v_item->>'product_id')::uuid and is_active for update;
    if not found then raise exception 'One of the items is no longer available'; end if;
    if v_prod.stock < v_qty then raise exception 'Not enough stock for %', v_prod.name; end if;
    update public.products set stock = stock - v_qty where id = v_prod.id;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order.id, v_prod.id, v_prod.name, v_prod.price, v_qty);
    v_subtotal := v_subtotal + (v_prod.price * v_qty);
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal + v_fee where id = v_order.id returning * into v_order;
  insert into public.order_events (order_id, actor_id, to_status, note) values (v_order.id, v_uid, 'new', 'Order placed');
  return v_order;
end $$;

-- Staff/admin: any status + assign driver. Driver: only their own assigned orders, forward steps only.
create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status default null,
  p_note text default null,
  p_driver_id uuid default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_order public.orders;
  v_new public.order_status;
  v_rate numeric;
  v_pts integer;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role = 'member' then raise exception 'Not allowed' using errcode = '42501'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('delivered','cancelled') then raise exception 'This order is already %', v_order.status; end if;

  if v_role = 'driver' then
    if v_order.driver_id is distinct from v_uid then raise exception 'This order is not assigned to you' using errcode = '42501'; end if;
    if p_status is null or p_status not in ('picked','out_for_delivery','delivered') then
      raise exception 'Drivers can only mark picked, out for delivery or delivered';
    end if;
    if p_driver_id is not null then raise exception 'Drivers cannot reassign orders' using errcode = '42501'; end if;
  end if;

  v_new := coalesce(p_status, v_order.status);

  if p_driver_id is not null then
    if not exists (select 1 from public.profiles where id = p_driver_id and role = 'driver') then
      raise exception 'The selected user is not a driver';
    end if;
    update public.orders set driver_id = p_driver_id where id = p_order_id;
  end if;

  update public.orders set
    status = v_new,
    delivered_at = case when v_new = 'delivered' then now() else delivered_at end,
    payment_status = case when v_new = 'delivered' and payment_method = 'cod' then 'paid' else payment_status end
  where id = p_order_id returning * into v_order;

  if v_new = 'cancelled' then
    update public.products p set stock = p.stock + i.quantity
    from public.order_items i where i.order_id = p_order_id and i.product_id = p.id;
  end if;

  if v_new = 'delivered' and v_order.customer_id is not null then
    select coalesce((value->>'rate')::numeric, 0) into v_rate from public.settings where key = 'points_per_rand';
    v_pts := floor(v_order.subtotal * coalesce(v_rate, 0));
    if v_pts > 0 then
      insert into public.points_ledger (user_id, delta, reason, order_id)
      values (v_order.customer_id, v_pts, 'Order ' || v_order.order_number || ' delivered', v_order.id);
      update public.profiles set points = points + v_pts where id = v_order.customer_id;
    end if;
  end if;

  insert into public.order_events (order_id, actor_id, to_status, note)
  values (p_order_id, v_uid, v_new, coalesce(p_note, case when p_driver_id is not null then 'Driver assigned' else null end));
  return v_order;
end $$;

-- Member cancels their own order, only while it is still 'new'.
create or replace function public.cancel_my_order(p_order_id uuid) returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'new' then raise exception 'Only new orders can be cancelled - please contact the club'; end if;
  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  update public.products p set stock = p.stock + i.quantity
  from public.order_items i where i.order_id = p_order_id and i.product_id = p.id;
  insert into public.order_events (order_id, actor_id, to_status, note) values (p_order_id, auth.uid(), 'cancelled', 'Cancelled by member');
  return v_order;
end $$;

-- Staff approve/suspend members; only admins change roles. Everything is audited.
create or replace function public.admin_update_member(
  p_user_id uuid,
  p_member_status text default null,
  p_role public.app_role default null
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_row public.profiles;
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_role is not null and not public.is_admin() then raise exception 'Only admins can change roles' using errcode = '42501'; end if;
  if p_user_id = auth.uid() and p_role is not null and p_role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  if p_member_status is not null and p_member_status not in ('pending','active','suspended') then raise exception 'Invalid membership status'; end if;

  update public.profiles set
    member_status = coalesce(p_member_status, member_status),
    role = coalesce(p_role, role)
  where id = p_user_id returning * into v_row;
  if not found then raise exception 'Member not found'; end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'member_update', 'profile', p_user_id::text, jsonb_build_object('member_status', p_member_status, 'role', p_role));
  return v_row;
end $$;

-- Dashboard numbers for the back office (South Africa day boundary).
create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_day timestamptz := date_trunc('day', now() at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg';
  v jsonb;
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'orders_today', (select count(*) from public.orders where created_at >= v_day and status <> 'cancelled'),
    'revenue_today', coalesce((select sum(total) from public.orders where created_at >= v_day and status <> 'cancelled'), 0),
    'open_orders', (select count(*) from public.orders where status in ('new','confirmed','picked','out_for_delivery')),
    'by_status', coalesce((select jsonb_object_agg(s.status::text, s.c) from (select status, count(*) as c from public.orders group by status) s), '{}'::jsonb),
    'members_active', (select count(*) from public.profiles where role = 'member' and member_status = 'active'),
    'members_pending', (select count(*) from public.profiles where role = 'member' and member_status = 'pending'),
    'low_stock', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock) order by stock) from public.products where is_active and stock <= 5), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- Lock down function execution: signed-in users only.
revoke execute on function public.place_order(jsonb,text,text,text,text,text,text,text) from public, anon;
revoke execute on function public.update_order_status(uuid,public.order_status,text,uuid) from public, anon;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
revoke execute on function public.admin_update_member(uuid,text,public.app_role) from public, anon;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.place_order(jsonb,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.update_order_status(uuid,public.order_status,text,uuid) to authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;
grant execute on function public.admin_update_member(uuid,text,public.app_role) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Realtime for live order boards (ignore if already added)
do $$ begin alter publication supabase_realtime add table public.orders; exception when others then null; end $$;

-- =====================================================================
-- BOOTSTRAP YOUR FIRST ADMIN (run once, after you have signed up / created your auth user):
--   update public.profiles set role = 'admin', member_status = 'active' where email = 'YOUR_EMAIL_HERE';
-- =====================================================================
