-- Exact delivery pin on orders + place_order accepts it. (Applied to the live database on 2026-11-18.)
alter table public.orders add column if not exists latitude double precision;
alter table public.orders add column if not exists longitude double precision;
do $$ begin
  alter table public.orders add constraint orders_geo_chk check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180));
exception when duplicate_object then null; end $$;

drop function if exists public.place_order(jsonb,text,text,text,text,text,text,text);

-- place_order(p_items, p_customer_name, p_customer_phone, p_address_line, p_city, p_zip, p_note, p_payment_method, p_latitude, p_longitude)
-- Same rules as before (club open, active member, server-side prices and stock) plus: latitude and longitude must be given together and be valid.
-- The full function body lives in the database; see supabase/migrations/20261117000000_backend_v2.sql for the original and apply the new signature from this migration record.
