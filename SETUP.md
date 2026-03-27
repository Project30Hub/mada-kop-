# 🚀 MadaKop Setup Guide

## Your System Has 3 Portals

1. **Customer Portal** (`order.html`) — Place orders, auto-send WhatsApp alerts
2. **Admin Dashboard** (`admin.html`) — Manage members, products, orders
3. **Driver Dashboard** (`driver.html`) — View & fulfill orders

---

## 🔧 Step 1: Configure Supabase

### Get Your Credentials
1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use existing
3. Go to **Settings → API**
4. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **Anon Key** (long string starting with `eyJ...`)

### Update Config File
Edit `supabase_config.js`:
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your-key...';
```

---

## 🗄️ Step 2: Create Database Table

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
CREATE TABLE IF NOT EXISTS delivery_orders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  addressLine TEXT NOT NULL,
  city TEXT NOT NULL,
  zip TEXT NOT NULL,
  productId TEXT NOT NULL,
  productName TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  productTotal REAL NOT NULL,
  deliveryFee REAL NOT NULL,
  total REAL NOT NULL,
  codProduct BOOLEAN DEFAULT FALSE,
  codDelivery BOOLEAN DEFAULT FALSE,
  note TEXT,
  status TEXT DEFAULT 'New',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write orders
CREATE POLICY "public_delivery_orders" ON delivery_orders
FOR ALL USING (true) WITH CHECK (true);
```

---

## 📱 Step 3: Test the System

### 1. Customer Places Order
- Open `order.html` in browser
- Fill out delivery form completely
- Click **"📦 Create Order"** button
- It will save to localStorage (works offline!)
- If Supabase is connected, it also saves to database

### 2. Check Orders in Supabase
- Go to Supabase Dashboard → Table Editor
- Click **delivery_orders** table
- You should see the order with status "New"

### 3. Admin Views Orders
- Open `admin.html`
- Enter Supabase credentials + password: `madakop2025`
- Click **"🚚 Delivery Orders"** tab
- See all orders, search, filter by status
- Update status: New → Picked → Delivered

### 4. Driver Gets Delivery
- Open `driver.html`
- Enter Supabase credentials + password: `driver2025`
- See dashboard with stats: total orders, new, picked, delivered
- Click **"View Details"** on any order
- See full customer address, phone,  notes
- Click **"Pick Up"** to change status to "Picked"
- Click **"Deliver"** to mark as "Delivered"

---

## 🔑 Change Passwords

### Admin Password
Edit `admin.html`, find line ~340:
```javascript
const ADMIN_PASSWORD = 'madakop2025';   // ← Change this!
```

### Driver Password
Edit `driver.html`, find line ~170:
```javascript
const DRIVER_PASSWORD = 'driver2025';   // ← Change this!
```

---

## 📶 Offline & Online Mode

### ✅ Works Online (with Supabase)
- Orders save to cloud database
- Admin & driver see live updates
- Data persists forever
- Multi-device sync

### ✅ Works Offline (localStorage)
- Orders save locally in browser
- No Supabase required
- Data persists on same device
- Syncs when connection returns

**Best Practice**: Always keep Supabase configured. Even if offline, localStorage acts as backup!

---

## 🐛 Troubleshooting

### "No rows returned"
- ✅ Normal! Means table is empty. Create a test order.

### Orders not showing in admin/driver
1. Check Supabase credentials are correct
2. Make sure `delivery_orders` table exists
3. Try refreshing browser
4. Check browser console (F12) for errors

### WhatsApp links not working
- Make sure phone numbers have country code (e.g., `+27736...`)
- Remove spaces/hyphens when saving orders

### Offline orders not syncing
- Orders in localStorage are local only
- When reconnected, they stay in localStorage
- Next orders go to both localStorage and Supabase

---

## 📊 What Gets Stored

### Supabase (Cloud)
- All new orders created while connected
- Status updates
- Permanent backup
- Accessible from admin/driver portals

### localStorage (Browser)
- All orders (with or without Supabase)
- Acts as offline cache
- Specific to each device/browser
- Survives page refreshes

---

## 🚀 Production Deployment

### Host Your Site (Recommended: Vercel)
1. Push code to GitHub
2. Connect repo to Vercel
3. Deploy automatically
4. Get HTTPS (required for Service Worker)

### Supabase in Production
- Use the same project
- Enable Row Level Security policies
- Restrict access as needed (optional)
- Monitor usage & scaling

---

## 📞 Support

If something breaks:
1. Check browser console (F12 → Console tab)
2. Look for red error messages
3. Make sure Supabase `supabase_config.js` has correct URL/key
4. Verify `delivery_orders` table exists in Supabase

---

**🌿 One Love Family** — MadaKop Delivery System
