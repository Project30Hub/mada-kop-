# MadaKop Backend v2

Additive backend that sits next to the existing site. Nothing in `index.html`, `admin.html`, `order.html`, `driver.html` etc. was changed, so the live site keeps working until you choose to switch.

## What was added

| Path | Purpose |
|---|---|
| `supabase/migrations/20261117000000_backend_v2.sql` | Roles, products/stock, orders + items + timeline, loyalty points, audit log, settings, Row Level Security, and the business-rule functions (RPCs) |
| `api/auth.js` | Login / refresh (Supabase Auth) |
| `api/orders.js` | Member API: menu, place order, my orders, cancel |
| `api/driver.js` | Driver API: my deliveries, mark picked / out for delivery / delivered |
| `api/admin.js` | Back-office API: stats, orders, members, products, settings, CSV export, create driver/staff |
| `back-office.html` | New back office UI (dashboard, orders, products, members, settings) |
| `supabase/optional/phase2_lockdown_legacy.sql` | Closes the old open-access tables. Do not run until the old pages are retired |
| `package.json`, `.env.example` | Dependency + environment variable list |

Only 4 new serverless functions were added (plus your 2 existing), well inside Vercel's 12-function Hobby limit.

## How it is secured

- Real accounts (Supabase Auth). Roles: `member`, `driver`, `staff`, `admin`.
- Every API call runs **as the signed-in user**, so Row Level Security is the real gatekeeper, not just the API code.
- Orders cannot be written directly from the browser. `place_order` calculates prices, stock and totals on the server side of the database, so a customer cannot change a price.
- Drivers can only touch orders assigned to them, and only move them forward.
- Staff approve members; only admins change roles or settings. Role changes are written to `audit_log`.
- A signed-in user cannot promote themselves (database trigger blocks role/points/status edits).
- The service-role key is used in exactly one place (creating driver/staff logins) and never reaches the browser.

## Go-live checklist

1. **Restore the Supabase project.** It currently shows as paused/inactive. Open the Supabase dashboard, select the Madakop project and restore it.
2. **Run the migration.** Paste `supabase/migrations/20261117000000_backend_v2.sql` into the SQL Editor and run it. Safe to re-run.
3. **Add environment variables in Vercel** (see `.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Create your admin login.** In Supabase, Authentication, Users, add your user. Then run:
   `update public.profiles set role = 'admin', member_status = 'active' where email = 'YOUR_EMAIL';`
5. **Test on the Vercel preview** for this branch, open `/back-office.html`, sign in, add a couple of products, create a driver login, and approve a test member.
6. **Merge** once the preview looks right.

## API quick reference

All calls send `Authorization: Bearer <access_token>` from `/api/auth`.

- `POST /api/auth` `{action:'login',email,password}` or `{action:'refresh',refresh_token}`
- `GET /api/orders?resource=menu` active products, delivery fee, open/closed flag
- `POST /api/orders` `{items:[{product_id,quantity}],customer_name,customer_phone,address_line,city,zip?,note?,payment_method?}`
- `GET /api/orders` my orders. `PATCH /api/orders` `{order_id}` cancels a new order
- `GET /api/driver`, `PATCH /api/driver` `{order_id,status}`
- `GET /api/admin?resource=stats|orders|members|products|settings|export` (plus POST/PATCH/DELETE on orders, members, products, settings, and `POST ?resource=create-staff`)

## Important security findings in the current (legacy) setup

These are in the existing code and docs, not in v2:

1. `SETUP.md` and `SYSTEM_STATUS.md` are in a **public** repo and state the admin and driver passwords. Treat those passwords as compromised and change them.
2. The legacy SQL gives anyone with the public anon key full read/write/delete on `delivery_orders` (policy `using (true)`), which exposes customer names, phone numbers and addresses.
3. The legacy `drivers` table stores plaintext passwords and is readable with the anon key.
4. Admin and driver login are checked in the browser, so they can be bypassed.

The v2 system fixes all four. Once the storefront uses `/api/orders`, run `supabase/optional/phase2_lockdown_legacy.sql`.

## Not done yet / next steps

- The existing storefront (`order.html`, `index.html`) still uses the legacy flow. It needs to be pointed at `/api/orders` (and a member login/register page on `/api/auth` plus Supabase sign-up).
- Payments: orders record the payment method (`cod`, `eft`, `payfast`), but no PayFast integration is wired in yet.
- Rate limiting is not included (serverless functions have no shared memory). Vercel's firewall rate limiting is the easy option.
- This code has not been run against the live database, because the Supabase project is paused. Test on a preview first.
