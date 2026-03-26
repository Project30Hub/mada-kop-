# Quick Reference Card

## 🚀 Boot Up Your System (3 Steps)

### Step 1: Get Supabase Credentials
```
supabase.com → New Project → Settings → API
Copy: Project URL + Anon Key
```

### Step 2: Update Config
```javascript
// File: supabase_config.js
const SUPABASE_URL = 'https://your-url.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

### Step 3: Create Table in Supabase (SQL)
```sql
CREATE TABLE delivery_orders (
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

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public" ON delivery_orders FOR ALL USING (true) WITH CHECK (true);
```

---

## 3 Portals

### 1️⃣ Customer Portal
**File**: `order.html`
**Does**: Place orders, add notes, send WhatsApp alerts
**Needs**: Nothing (works offline!)

### 2️⃣ Admin Dashboard
**File**: `admin.html`
**Password**: `madakop2025` (change this!)
**Does**: View/manage all orders, customer details, status updates
**Needs**: Supabase URL + Anon Key

### 3️⃣ Driver Portal
**File**: `driver.html`
**Password**: `driver2025` (change this!)
**Does**: See orders to deliver, customer contact, maps, update status
**Needs**: Supabase URL + Anon Key

---

## Test the System

```
1. Open order.html → Fill form → Click "Create Order"
2. Check Supabase dashboard → Table: delivery_orders (should see order!)
3. Open admin.html → Enter credentials → Find order in "Delivery Orders" tab
4. Open driver.html → Enter credentials → See order in table
5. Click "View Details" → See customer address & phone
6. Click "Pick Up" → Status changes to "Picked"
7. Click "Deliver" → Status changes to "Delivered"
8. Go back to admin.html → See updated status!
```

---

## Files to Know

```
Root:
├── supabase_config.js        ⚙️  EDIT: Add credentials here
├── order.html                🛒 Customer orders
├── admin.html                👨‍💼 Admin management
├── driver.html               🚚 Driver deliveries
├── index.html                🏠 Homepage (main site)
├── SETUP.md                  📖 Full setup guide
├── SYSTEM_STATUS.md          ✅ What's been fixed
└── QUICK_REF.md              📋 This file

Others (untouched):
├── members.html              (Member login)
├── login.html                (Member login)
├── register.html             (Member signup)
├── admin.html                (Existing admin panel - enhanced!)
└── ... etc
```

---

## Common Tasks

### Change Admin Password
**File**: `admin.html`
**Line**: ~340
```javascript
const ADMIN_PASSWORD = 'madakop2025';   // ← Your new password
```

### Change Driver Password
**File**: `driver.html`
**Line**: ~170
```javascript
const DRIVER_PASSWORD = 'driver2025';   // ← Your new password
```

### Change WhatsApp Numbers
**File**: `order.html`
**Lines**: ~121-122
```javascript
const ADMIN_NUMBER = '27736292224';   // ← Admin WhatsApp
const DRIVER_NUMBER = '27730000000';  // ← Driver WhatsApp
```

### Change Delivery Fee
**File**: `order.html`
**Search**: "deliveryFee = 80"  
```javascript
const deliveryFee = 80;  // ← Change to your fee (R80 = default)
```

### Change Product Prices
**File**: `order.html`
**Lines**: ~128-134
```javascript
const PRODUCTS = [
  {id:'garden-reserve', name:'Garden Reserve Indoor (1 pack)', price:450},
  // Edit price numbers here: 450, 380, 420, 500, 520
];
```

---

## Passwords to Change

| Portal | Default | File | Line |
|--------|---------|------|------|
| Admin | `madakop2025` | admin.html | ~340 |
| Driver | `driver2025` | driver.html | ~170 |

---

## Status Field Values

```
New        → Order just created
Picked     → Driver picked up order
Delivered  → Order completed
```

---

## Offline Mode

orders.html works without Supabase! Uses `localStorage`:
- Orders save locally
- Works with no internet
- Syncs to Supabase when connection returns
- Data never lost

---

## Get Help

**Error messages?** Press `F12` → Console tab
**Supabase issues?** Check credentials in `supabase_config.js`
**Orders not showing?** Make sure `delivery_orders` table created in Supabase
**WhatsApp not working?** Check phone number format (+27...)

---

**Ready to go!** 🌿 Open order.html and create your first order.

