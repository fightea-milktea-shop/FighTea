# FighTea — Milk Tea Shop Ordering System

**Version 5.0 · Production-Ready**

A full-stack POS and online ordering system for a small milk tea business. Customers browse the menu, customize drinks and food, and pay via Cash or GCash. Admins manage the full menu, categories, toppings, sizes, varieties, promos, orders, and users through a dashboard.

---

## Project Structure

```
FighTea/
├── frontend/                   ← Static website (deploy to Vercel)
│   ├── html/
│   │   └── index.html          ← Single-page application
│   ├── css/
│   │   └── style.css           ← Beige design system, fully responsive
│   ├── js/
│   │   ├── data.js             ← App state, API helpers, analytics
│   │   ├── app.js              ← Auth, menu, cart, checkout, GCash
│   │   └── admin.js            ← Dashboard: queue, menu CRUD, promos, users
│   ├── assets/
│   │   └── logo.png            ← Shop logo
│   ├── vercel.json             ← Vercel routing config
│   └── package.json
│
├── backend/                    ← Node.js REST API (deploy to Vercel)
│   ├── server.js               ← Express entry point
│   ├── package.json
│   ├── .env.example            ← Copy to .env and fill in values
│   ├── vercel.json             ← Vercel serverless config
│   ├── config/
│   │   └── db.js               ← MySQL connection pool
│   ├── middleware/
│   │   └── auth.js             ← JWT verification middleware
│   ├── routes/
│   │   ├── auth.js             ← POST /api/auth/login|register, GET /api/auth/me
│   │   ├── menu.js             ← GET|POST|PUT|DELETE /api/menu/*
│   │   ├── orders.js           ← POST|GET|PATCH|PUT /api/orders
│   │   ├── users.js            ← GET|POST|PUT|DELETE /api/users
│   │   └── analytics.js        ← GET /api/analytics/summary
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── menuController.js
│   │   ├── orderController.js
│   │   ├── userController.js
│   │   └── analyticsController.js
│   ├── middleware/
│   │   └── auth.js
│   └── database/
│       ├── schema.sql          ← All table definitions (run first)
│       ├── inventory.sql       ← Size and ice options only
│       └── users.sql           ← Default admin account
│
└── README.md                   ← This file
```

---

## Features

| Area | What it does |
|------|-------------|
| Customer | Sign up / log in, browse menu by category, customize drinks (size, ice, toppings), see available promos, add to cart, pay via Cash or GCash |
| Admin Queue | Live order board, status transitions (Pending → Preparing → Ready → Done), edit any order |
| Menu Manager | Add/edit/remove products, categories, sizes (per-item optional), toppings, varieties, promos |
| Promo Manager | Create buy-1-take-1 or discount promos tied to specific items, varieties, or sizes |
| Analytics | Live revenue, today's sales, top sellers, order status breakdown |
| User Manager | Add/edit/remove staff and customer accounts with role permissions |
| Responsive | Works on mobile (360px), tablet (768px), and desktop (1200px+) |

---

## Role Permissions

| Feature | Admin | Staff | Customer |
|---------|:-----:|:-----:|:--------:|
| Order queue + edit | ✅ | ✅ | — |
| Menu / Category / Topping / Size / Promo CRUD | ✅ | — | — |
| User management | ✅ | — | — |
| Analytics | ✅ | — | — |
| Place orders | ✅ | ✅ | ✅ |

---

## Part 1 — Database Setup (MySQL)

### Prerequisites
- MySQL 8.0+ installed locally or hosted (PlanetScale, Railway, Clever Cloud)
- `mysql` CLI available in your terminal

### Step 1 — Create the database and tables

```bash
mysql -u root -p < backend/database/schema.sql
```

This creates the `fightea_db` database and all tables including:
`users`, `categories`, `products`, `product_varieties`, `size_options`,
`ice_options`, `toppings`, `orders`, `order_items`, `order_item_toppings`,
`order_status_log`, `payments`, `promos`, `promo_items`

> **Note:** All `CREATE TABLE` statements use `IF NOT EXISTS`. Running this file again is safe.

### Step 2 — Load the default options

```bash
mysql -u root -p fightea_db < backend/database/inventory.sql
```

This inserts the fixed size options (Small, Medium, Large) and ice options using `INSERT IGNORE` — safe to re-run.

### Step 3 — Create the default admin account

**First, generate a real bcrypt hash for your chosen password:**

```bash
# In the backend folder (after npm install):
node -e "require('bcrypt').hash('YourStrongPassword',12).then(h=>console.log(h))"
```

You will see output like:
```
$2b$12$AbcDefGhiJkLmNoPqRsTuV...
```

**Open `backend/database/users.sql`** and replace:
```sql
'$2b$12$REPLACE_THIS_WITH_YOUR_REAL_BCRYPT_HASH'
```
with the hash you just generated. Save the file, then run:

```bash
mysql -u root -p fightea_db < backend/database/users.sql
```

> `INSERT IGNORE` prevents duplicate entry errors if you run this file more than once.

### Step 4 — Verify

```bash
mysql -u root -p fightea_db -e "SELECT id, full_name, email, role FROM users;"
```

Expected output:
```
+----+--------------+---------------------+-------+
| id | full_name    | email               | role  |
+----+--------------+---------------------+-------+
|  1 | FighTea Admin| admin@fightea.com   | admin |
+----+--------------+---------------------+-------+
```

### Troubleshooting — Database

| Error | Cause | Fix |
|-------|-------|-----|
| `ERROR 1044 (42000): Access denied` | Wrong MySQL user or no privileges | Run `GRANT ALL ON fightea_db.* TO 'root'@'localhost'; FLUSH PRIVILEGES;` |
| `ERROR 1215 (HY000): Cannot add foreign key` | Tables created in wrong order | Drop the database and re-run `schema.sql` from scratch |
| `ERROR 1062 (23000): Duplicate entry` for email | users.sql run twice without `INSERT IGNORE` | Already handled — `users.sql` uses `INSERT IGNORE` |
| `ERROR 1292: Incorrect date value` | MySQL strict mode, `DEFAULT (CURRENT_DATE)` not supported | Upgrade to MySQL 8.0.13+ or change `DEFAULT (CURRENT_DATE)` to `DEFAULT NULL` in schema.sql |
| `Unknown column 'has_sizes'` | Old schema without v5 migration | Run: `ALTER TABLE products ADD COLUMN has_sizes TINYINT(1) NOT NULL DEFAULT 0;` |
| `Table 'promos' doesn't exist` | v5 tables not created | Re-run `schema.sql` — all new tables use `CREATE TABLE IF NOT EXISTS` |

---

## Part 2 — Backend Setup (Node.js)

### Prerequisites
- Node.js 18+ installed: [nodejs.org](https://nodejs.org)
- MySQL database ready (Part 1 complete)

### Step 1 — Install dependencies

```bash
cd backend
npm install
```

This installs: `express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`
Dev dependency: `nodemon` (for auto-restart during development)

### Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=fightea_db

JWT_SECRET=replace_with_64_chars_of_random_text
FRONTEND_URL=http://localhost:3000
```

**Generating a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output (96 hex characters) and paste it as your `JWT_SECRET`.

### Step 3 — Start the development server

```bash
npm run dev       # uses nodemon — auto-restarts on file changes
# OR
npm start         # uses plain node
```

You should see:
```
✅ MySQL connected to fightea_db
🧋 FighTea API running → http://localhost:4000
   Environment : development
   Frontend URL: http://localhost:3000
```

### Step 4 — Test the API

```bash
# Health check
curl http://localhost:4000/api/health

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fightea.com","password":"YourStrongPassword"}'
```

A successful login returns:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "FighTea Admin", "role": "admin" }
}
```

### API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | — | Login, returns JWT token |
| POST | /api/auth/register | — | Register new customer |
| GET | /api/auth/me | Any | Get current user |
| GET | /api/menu/categories | — | List categories |
| POST | /api/menu/categories | Admin | Create category |
| PUT | /api/menu/categories/:id | Admin | Rename category |
| DELETE | /api/menu/categories/:id | Admin | Remove category |
| GET | /api/menu/products | — | Get menu items (+ varieties) |
| POST | /api/menu/products | Admin | Add product |
| PUT | /api/menu/products/:id | Admin | Update product |
| DELETE | /api/menu/products/:id | Admin | Remove product |
| GET | /api/menu/sizes | — | Get global sizes |
| POST | /api/menu/sizes | Admin | Add size |
| PUT | /api/menu/sizes/:id | Admin | Edit size |
| DELETE | /api/menu/sizes/:id | Admin | Remove size |
| GET | /api/menu/toppings | — | Get toppings |
| POST | /api/menu/toppings | Admin | Add topping |
| PUT | /api/menu/toppings/:id | Admin | Edit topping |
| DELETE | /api/menu/toppings/:id | Admin | Remove topping |
| GET | /api/menu/promos | — | Get promos |
| POST | /api/menu/promos | Admin | Create promo |
| PUT | /api/menu/promos/:id | Admin | Edit promo |
| DELETE | /api/menu/promos/:id | Admin | Delete promo |
| POST | /api/orders | Any | Place order |
| GET | /api/orders?status= | Staff/Admin | Get orders |
| PATCH | /api/orders/:id/status | Staff/Admin | Update order status |
| PUT | /api/orders/:id | Staff/Admin | Edit order |
| GET | /api/users | Admin | List users |
| POST | /api/users | Admin | Create user |
| PUT | /api/users/:id | Admin | Update user |
| DELETE | /api/users/:id | Admin | Delete user |
| GET | /api/analytics/summary | Admin | Revenue + stats |

### Troubleshooting — Backend

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:3306` | MySQL not running | Start MySQL: `sudo systemctl start mysql` (Linux) or open MySQL Workbench (Windows/Mac) |
| `ER_ACCESS_DENIED_ERROR` | Wrong DB_USER or DB_PASS in .env | Verify credentials with `mysql -u root -p` |
| `JsonWebTokenError: invalid signature` | JWT_SECRET changed after tokens were issued | Re-login to get a new token |
| `TokenExpiredError: jwt expired` | Token older than 8 hours | Re-login |
| `SyntaxError: Cannot use import` | Using ES module syntax in CommonJS file | All backend files use `require()`, not `import`. Check for copy-paste errors. |
| `CORS error in browser` | FRONTEND_URL in .env doesn't match frontend origin | Set `FRONTEND_URL=http://localhost:3000` exactly (no trailing slash) |
| Port 4000 already in use | Another process using port 4000 | Change `PORT=4001` in .env or kill the process: `lsof -ti:4000 \| xargs kill` |

---

## Part 3 — Frontend Setup

The frontend is a static HTML/CSS/JS site with no build step. It communicates with the backend API via `fetch()`.

### Step 1 — Serve locally

```bash
cd frontend
npx serve . -p 3000
# OR open html/index.html directly in a browser (works offline for demo)
```

### Step 2 — Connect to the backend API

Open `frontend/js/data.js`. At the top, set the `API_BASE` constant:

```js
// Change this to your backend URL before going live:
const API_BASE = 'http://localhost:4000/api';   // development
// const API_BASE = 'https://fightea-api.vercel.app/api';  // production
```

### Step 3 — Wire up auth (replace localStorage with JWT)

In `data.js`, update `saveSession` to store the JWT:

```js
function saveSession(data) {
  App.currentUser = data.user;
  localStorage.setItem('fightea_token', data.token);
}
async function loadSession() {
  const token = localStorage.getItem('fightea_token');
  if (!token) return;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.ok) App.currentUser = await res.json();
  else clearSession();
}
function clearSession() {
  App.currentUser = null;
  localStorage.removeItem('fightea_token');
}
```

### Step 4 — Load menu from API

Replace the empty `MENU_ITEMS` initialization in `data.js`:

```js
async function loadMenuFromAPI() {
  const [cats, products, sizes, toppings, promos] = await Promise.all([
    fetch(`${API_BASE}/menu/categories`).then(r => r.json()),
    fetch(`${API_BASE}/menu/products`).then(r => r.json()),
    fetch(`${API_BASE}/menu/sizes`).then(r => r.json()),
    fetch(`${API_BASE}/menu/toppings`).then(r => r.json()),
    fetch(`${API_BASE}/menu/promos`).then(r => r.json()),
  ]);
  MENU_CATEGORIES = cats.map(c => c.name);
  MENU_ITEMS = products.map(p => ({
    id: p.id, cat: p.category, name: p.name, desc: p.description,
    basePrice: p.base_price, image: p.image_url, emoji: p.emoji,
    bestseller: !!p.is_bestseller, available: !!p.is_available,
    hasSizes: !!p.has_sizes, varieties: p.varieties || [], sizes: [],
  }));
  GLOBAL_SIZES = sizes.map(s => ({ id: s.id, label: s.label, priceAdd: s.price_add }));
  TOPPINGS = toppings.map(t => ({ id: t.id, name: t.name, emoji: t.emoji, price: t.price }));
  PROMOS = promos.map(p => ({ id: p.id, name: p.name, badge: p.badge, description: p.description,
    isActive: !!p.is_active, items: (p.items||[]).map(i => ({ itemId: i.product_id,
      varietyId: i.variety_id, sizeId: i.size_id, promoPrice: i.promo_price })) }));
}
```

Call `await loadMenuFromAPI()` inside `renderMenuPage()` and `renderBestsellers()` before rendering.

### Step 5 — Send orders to API

In `app.js`, replace `ORDERS.unshift(order)` in `placeOrder()` with:

```js
const token = localStorage.getItem('fightea_token');
const res = await fetch(`${API_BASE}/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    items: App.cart.map(i => ({
      product_id: i.itemId, name: i.name, size: i.size, size_price: 0,
      ice: i.ice, toppings: i.toppings.map(name => {
        const t = TOPPINGS.find(t => t.name === name);
        return { name, price: t?.price || 15 };
      }),
      qty: i.qty, unit_price: i.price, line_total: i.price * i.qty,
    })),
    payment_method: selectedPayment, gcash_ref: gcashRef || null,
    notes: document.getElementById('order-notes')?.value || '',
  }),
});
const data = await res.json();
if (!res.ok) { showToast(data.error || 'Order failed.', 'error'); return; }
```

---

## Part 4 — Deployment

### Architecture Overview

```
[Customer Browser]
       │ HTTPS
       ▼
[Vercel — Frontend]          (static site: html/css/js)
       │ fetch() API calls
       ▼
[Vercel — Backend API]       (Node.js serverless functions)
       │ mysql2
       ▼
[PlanetScale / Railway]      (MySQL database)
       │ DNS
       ▼
[Hostinger Domain]           (yourdomain.com → Vercel frontend)
```

---

### Step A — Set up a hosted MySQL database (PlanetScale recommended)

PlanetScale offers a free-tier MySQL-compatible database.

1. Go to [planetscale.com](https://planetscale.com) → Sign up → Create a database named `fightea_db`
2. Click **Connect** → choose **Node.js** → copy the connection string
3. Click **Branches** → `main` → **Console**
4. Paste and run your SQL files in the console — or use the CLI:

```bash
npm install -g pscale
pscale auth login
pscale database create fightea_db --region ap-southeast
pscale shell fightea_db main < backend/database/schema.sql
pscale shell fightea_db main < backend/database/inventory.sql
pscale shell fightea_db main < backend/database/users.sql
```

> **Note:** PlanetScale does not support foreign key constraints by default. If you get errors, remove `FOREIGN KEY` lines from `schema.sql` before importing, or use Railway instead.

**Alternative — Railway (supports FK constraints):**

1. Go to [railway.app](https://railway.app) → New Project → Add MySQL service
2. Click the MySQL service → **Variables** tab → copy `MYSQL_URL`
3. Under **Data** tab → use the query console to run your SQL files

---

### Step B — Deploy the Backend to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to the backend folder and deploy:**
   ```bash
   cd backend
   vercel
   ```
   - Set up and deploy: **Y**
   - Which scope: select your account
   - Link to existing project: **N**
   - Project name: `fightea-api`
   - Directory: `./` (current folder)
   - Override settings: **N**

3. **Add environment variables on Vercel:**
   ```bash
   vercel env add DB_HOST
   vercel env add DB_PORT
   vercel env add DB_USER
   vercel env add DB_PASS
   vercel env add DB_NAME
   vercel env add JWT_SECRET
   vercel env add FRONTEND_URL
   ```
   Set each to your production values. Set `NODE_ENV=production`.

   Or add them all at once in the **Vercel Dashboard → Project → Settings → Environment Variables**.

4. **Redeploy to apply env variables:**
   ```bash
   vercel --prod
   ```

5. **Test the live API:**
   ```bash
   curl https://fightea-api.vercel.app/api/health
   ```

---

### Step C — Deploy the Frontend to Vercel

1. **Update `API_BASE` in `frontend/js/data.js`:**
   ```js
   const API_BASE = 'https://fightea-api.vercel.app/api';
   ```

2. **Deploy the frontend:**
   ```bash
   cd frontend
   vercel
   ```
   - Project name: `fightea`
   - Directory: `./`

3. **Add the CORS environment variable on the backend:**
   Go to Vercel → fightea-api → Settings → Environment Variables → add:
   ```
   FRONTEND_URL = https://fightea.vercel.app
   ```
   Then redeploy the backend: `vercel --prod`

4. **Verify the live site:**
   - Open `https://fightea.vercel.app`
   - Log in with your admin credentials
   - Confirm you can see the dashboard

---

### Step D — Connect a Hostinger Domain

This connects your domain (e.g. `www.yourdomain.com`) to your Vercel frontend.

**Step D1 — Add domain in Vercel:**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → select `fightea` project
2. Click **Settings** → **Domains** → type your domain: `yourdomain.com`
3. Also add: `www.yourdomain.com`
4. Vercel shows you DNS records to add. Copy them — you'll need these next.

**Step D2 — Configure DNS on Hostinger:**

1. Log in to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Go to **Domains** → click your domain → **DNS / Nameservers**
3. Click **Manage DNS Records**
4. **Delete** the existing `A` record for `@` (root domain) if present
5. **Add these records** from Vercel:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | `A` | `@` | `76.76.21.21` | 3600 |
   | `CNAME` | `www` | `cname.vercel-dns.com.` | 3600 |

6. Click **Save**

> **DNS propagation takes 15 minutes to 48 hours.** You can check progress at [dnschecker.org](https://dnschecker.org).

**Step D3 — Add SSL (HTTPS):**

Vercel automatically provisions a free SSL certificate via Let's Encrypt once DNS propagates. No action needed — the padlock will appear automatically.

**Step D4 — Update CORS for your domain:**

After DNS is live, update the backend environment variable on Vercel:
```
FRONTEND_URL = https://www.yourdomain.com
```
Redeploy: `vercel --prod` (in the backend folder)

---

### Step E — Update API_BASE for custom domain (optional)

If you also set a custom domain for your backend API (e.g. `api.yourdomain.com`):

1. In Vercel → fightea-api → Settings → Domains → add `api.yourdomain.com`
2. In Hostinger DNS → add `CNAME` record: `api` → `cname.vercel-dns.com.`
3. Update `frontend/js/data.js`:
   ```js
   const API_BASE = 'https://api.yourdomain.com/api';
   ```
4. Redeploy frontend: `vercel --prod` (in the frontend folder)

---

## Part 5 — Admin First-Time Setup

After deployment, complete this setup in the Admin Dashboard:

1. **Log in** at `https://yourdomain.com` with `admin@fightea.com`
2. **Add Categories** (Dashboard → Menu Manager → Categories → + Add Category)
   e.g. "Milk Tea", "Fruit Tea", "Specialty", "Coffee", "Food", "Snacks"
3. **Add Sizes** (Menu Manager → Sizes → + Add Size)
   e.g. Small (₱0 add-on), Medium (₱0), Large (₱20 add-on)
   > Sizes only appear for items with "Enable Sizes" checked
4. **Add Toppings** (Menu Manager → Toppings → + Add Topping)
   e.g. Tapioca Pearls (₱15), Pudding (₱15), Popping Boba (₱15)
5. **Add Menu Items** (Menu Manager → + Add Item)
   - Check "Enable Sizes" for drinks
   - Add "Varieties" for food items (e.g. Regular, Cheesy, Overload)
   - Upload a product photo or paste an image URL
6. **Add Promos** (Dashboard → Promos → + Add Promo)
7. **Update GCash Number** (Dashboard → Settings → GCash Number)
8. **Add Staff Accounts** (Dashboard → Users → + Add User → role: Staff)
9. **Change the admin password** by editing the admin user

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | Server port (Vercel ignores this) | `4000` |
| `NODE_ENV` | Yes | `development` or `production` | `production` |
| `DB_HOST` | Yes | MySQL host | `aws.connect.psdb.cloud` |
| `DB_PORT` | No | MySQL port (default 3306) | `3306` |
| `DB_USER` | Yes | MySQL username | `fightea_user` |
| `DB_PASS` | Yes | MySQL password | `strongpassword123` |
| `DB_NAME` | Yes | Database name | `fightea_db` |
| `JWT_SECRET` | Yes | Secret for signing tokens (min 32 chars) | `abc123...` (96 hex chars) |
| `FRONTEND_URL` | Yes | Allowed CORS origin | `https://yourdomain.com` |

---

## Troubleshooting — Deployment

| Problem | Cause | Fix |
|---------|-------|-----|
| Vercel build fails with `Cannot find module 'express'` | `node_modules` not installed | Run `npm install` locally, push `package.json` and `package-lock.json` |
| API returns 500 on Vercel but works locally | Missing env variables on Vercel | Check all variables are set in Vercel Dashboard → Settings → Environment Variables |
| `ERR_CONNECTION_REFUSED` from Vercel to DB | Firewall blocking Vercel IPs | In your DB host, allow connections from `0.0.0.0/0` (all IPs) or add Vercel's IP ranges |
| CORS error in production | `FRONTEND_URL` not updated after domain change | Update `FRONTEND_URL` in Vercel env and redeploy backend |
| Domain not resolving | DNS not propagated | Wait up to 48 hours. Check at [dnschecker.org](https://dnschecker.org) |
| SSL padlock not showing | DNS still propagating | Wait and refresh. Vercel auto-provisions SSL once DNS is verified |
| GCash deep link not working | Site not on HTTPS | Ensure your site uses `https://` — GCash deep links require HTTPS on mobile |
| PlanetScale FK error | PlanetScale doesn't support FK by default | Remove `FOREIGN KEY` lines from `schema.sql` or switch to Railway |
| Admin can't log in after deploy | Bcrypt hash still placeholder | Re-run the hash generation step, update `users.sql`, re-import |
| Vercel function timeout | Heavy DB query | Vercel free tier has 10s timeout. Optimize queries or upgrade plan |

---

## Security Checklist Before Going Live

- [ ] Change admin password from the default
- [ ] Replace placeholder bcrypt hash with a real one in `users.sql`
- [ ] Generate a unique `JWT_SECRET` (minimum 64 characters)
- [ ] Set `NODE_ENV=production` in Vercel
- [ ] Set `FRONTEND_URL` to your exact production domain (no trailing slash)
- [ ] Enable HTTPS on your domain (Vercel does this automatically)
- [ ] Never commit `.env` to Git (it is in `.gitignore`)
- [ ] In production, restrict DB access to only your backend server's IP if possible

---

## Design System

| Token | Value | Use |
|-------|-------|-----|
| `--cream` | `#FBF5EA` | Page background |
| `--beige` | `#F0E4C8` | Cards, borders |
| `--brown` | `#7C4F2A` | Primary buttons, prices |
| `--brown-deep` | `#4A2C0E` | Hero, sidebar |
| `--blush` | `#DFA58A` | Accents |
| `--teal` | `#2D7268` | Success states |
| `--gold` | `#C9921A` | Best seller ribbon |
| Fonts | Cormorant Garamond + Outfit | Display + Body |

---

Built with love for small businesses. 🧋
