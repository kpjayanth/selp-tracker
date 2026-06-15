# SELP Tracker

A full-stack web application for managing Self-Expression and Leadership Program (SELP) cohorts. Built on React + Node.js + PostgreSQL with AES-256-GCM PII field encryption and role-based access control.

## Free Hosting Stack

| Layer | Service | Cost |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Free |
| Backend API | [Render](https://render.com) | Free (spins down after 15 min idle) |
| Database | [Neon](https://neon.tech) | Free (0.5 GB, serverless Postgres) |
| File storage | Local disk on Render (ephemeral) | Free |

> **Upgrade path:** For persistent file storage, swap to [Cloudflare R2](https://cloudflare.com/products/r2/) (free 10 GB/month). For always-on API, upgrade Render to $7/mo.

---

## Project Structure

```
selp-tracker-app/
├── client/          # React + Vite + Tailwind frontend
└── server/          # Node.js + Express + Prisma backend
```

---

## Local Development

### 1. Database (Neon — free)

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project → copy the connection string (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

### 2. Backend setup

```bash
cd server
cp .env.example .env
# Edit .env — fill in DATABASE_URL from Neon
# Generate keys:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # → ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # → HMAC_KEY
# Set a strong JWT_SECRET (at least 32 random chars)

npm install
npm run db:generate     # generate Prisma client
npm run db:push         # push schema to Neon
npm run db:seed         # create admin@selp.org / Admin1234!
npm run dev             # starts on :4000
```

### 3. Frontend setup

```bash
cd client
npm install
npm run dev   # starts on :5173, proxies /api → :4000
```

Open [http://localhost:5173](http://localhost:5173) and sign in with `admin@selp.org` / `Admin1234!`.

---

## Deploy to Production (Free)

### Step 1 — Deploy backend to Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo
3. Set **Root Directory** to `server`
4. **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
5. **Start Command:** `npm start`
6. Add environment variables (Settings → Environment):

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | 32+ random chars |
| `ENCRYPTION_KEY` | 64-char hex (see above) |
| `HMAC_KEY` | 64-char hex (see above) |
| `CLIENT_URL` | Your Vercel URL (add after step 2) |
| `NODE_ENV` | `production` |

7. Deploy → copy the Render URL (e.g. `https://selp-tracker-api.onrender.com`)

### Step 2 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import your repo
2. Set **Root Directory** to `client`
3. Add environment variable:

| Key | Value |
|---|---|
| `VITE_API_URL` | Your Render URL from step 1 |

4. Deploy → copy the Vercel URL

5. Go back to Render → update `CLIENT_URL` to the Vercel URL → redeploy

### Step 3 — Seed the admin user

In Render → your service → Shell:

```bash
node prisma/seed.js
```

Default admin: `admin@selp.org` / `Admin1234!` — **change password immediately after first login.**

---

## Security Notes

- **PII fields** (name, phone, family, profile text) are AES-256-GCM encrypted at the application layer before reaching the DB. A database dump exposes only ciphertext.
- **HMAC search tokens** allow exact name-match search without decrypting all rows.
- **RBAC** is enforced server-side per program and per group.
- **JWT** sessions expire after 8 hours.
- All secrets live in environment variables — never in source code.

---

## Default Roles

| Role | Access |
|---|---|
| Leader | Full program admin, creates programs, hard-delete |
| Program Coach | Sees all groups, can assign members |
| Head Coach | Sees all groups, manages groups |
| Coach | Sees only their assigned group(s) |

---

## Excel Import

Upload `SELP_projects_Mar8-2026.xlsx` (or any file matching the 12-column SELP intake format) via **Import Excel** on the program page. The importer:
1. Shows a preview (CREATE / UPDATE / SKIP per row)
2. Matches rows to existing participants by First Name + Last Name
3. Creates participants if not found (phone left blank — fill in manually)
4. Commits on confirmation
