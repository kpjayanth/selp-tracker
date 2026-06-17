# SELP Tracker — Architecture Document

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | June 2026 |
| **Stack** | React · Node.js/Express · PostgreSQL (Neon) |
| **Hosting** | Vercel (frontend) · Render (backend) · Neon (database) |

---

## 1. System Overview

SELP Tracker is a **three-tier web application** for managing Self-Expression and Leadership Program cohorts. It has a strict constraint from the PRD: *participants are subjects of the data, not users of the platform* — only the coaching team logs in.

```
┌─────────────────┐        HTTPS + JWT       ┌──────────────────┐        TLS         ┌─────────────────┐
│   React SPA     │ ─────────────────────── ▶ │  Node.js / Express│ ──────────────── ▶│  PostgreSQL      │
│   (Vercel)      │ ◀ ─────────────────────── │  (Render)         │ ◀──────────────── │  (Neon)         │
│                 │      JSON responses        │                  │  Prisma ORM        │                 │
└─────────────────┘                           └──────────────────┘                    └─────────────────┘
                                                       │
                                               PII decrypted server-side only
                                               Client never receives keys
```

**Key security principle:** The client receives only *already-decrypted* plaintext for records within the requester's scope. Encryption keys never leave the server process.

---

## 2. Hosting & Deployment

### 2.1 Infrastructure map

| Layer | Service | Plan | Notes |
|---|---|---|---|
| Frontend | **Vercel** | Free | Auto-deploys `client/` on push to `main` |
| Backend API | **Render** | Free (Web Service) | Auto-deploys `server/` on push to `main`; spins down after 15 min idle |
| Database | **Neon** | Free | Serverless PostgreSQL, 0.5 GB, connection pooling built-in |
| File storage | Render local disk | Free | Ephemeral — lost on redeploy. **Upgrade to Cloudflare R2 for production** |
| CI/CD | GitHub | Free | Repo: `kpjayanth/selp-tracker` |

### 2.2 Deployment flow

```
Developer pushes to GitHub main
        │
        ├──▶ Vercel detects change in client/
        │         npm install
        │         vite build          (VITE_API_URL baked in at build time)
        │         Deploy dist/ as CDN
        │
        └──▶ Render detects change in server/
                  npm install
                  npx prisma generate
                  npx prisma migrate deploy   ← runs pending migrations against Neon
                  node prisma/seed.js         ← idempotent upsert of admin user
                  node src/index.js           ← start server
```

### 2.3 Environment variables

**Render (server):**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (with `?sslmode=require`) |
| `JWT_SECRET` | Signs/verifies JWT sessions (min 32 random bytes) |
| `ENCRYPTION_KEY` | 64-char hex — AES-256-GCM master key for PII fields |
| `HMAC_KEY` | 64-char hex — HMAC-SHA256 key for search tokens |
| `CLIENT_URL` | Vercel URL for CORS allow-list |
| `NODE_ENV` | `production` |
| `PORT` | Set automatically by Render |

**Vercel (client):**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Render backend URL — baked into the JS bundle at build time |

> **Key rotation:** Changing `ENCRYPTION_KEY` invalidates all existing encrypted records. To rotate: decrypt all rows with the old key, re-encrypt with the new key, then redeploy. There is no automatic rotation in v1.

---

## 3. Frontend Architecture

### 3.1 Technology choices

| Choice | Rationale |
|---|---|
| **Vite** | Fast HMR in dev; optimised production bundles |
| **React 18** | Component model suits the tab-heavy SELP UI |
| **React Router v6** | File-based-style routing with nested layouts |
| **Tailwind CSS v3** | Utility classes eliminate CSS file sprawl; responsive by default |
| **Axios** | Interceptors make auth header injection and 401 redirect automatic |
| **react-hot-toast** | Non-blocking feedback for save/error operations |
| **@heroicons/react** | Consistent icon set, tree-shakeable |
| **date-fns** | Lightweight date formatting (no moment.js bloat) |

### 3.2 Directory structure

```
client/src/
├── api/
│   └── index.js          # All API calls in one place; axios instance with interceptors
├── contexts/
│   └── AuthContext.jsx   # Global auth state; token → localStorage
├── components/
│   └── Layout.jsx        # Header nav, outlet wrapper
├── pages/
│   ├── Login.jsx
│   ├── Programs.jsx       # Program list + create form
│   ├── ProgramDetail.jsx  # Tabs: Participants | Groups | Team
│   ├── ParticipantDetail.jsx  # Tabs: Profile | Project | Timeline
│   ├── ImportPage.jsx     # Excel upload → preview → commit
│   └── AuditPage.jsx      # Audit log table
├── App.jsx               # Route tree + RequireAuth guard
├── main.jsx              # React DOM root + BrowserRouter
└── index.css             # Tailwind directives + component classes
```

### 3.3 Auth flow

```
1. User POSTs /api/auth/login
2. Server returns { token, user }
3. AuthContext stores token in localStorage, user in React state
4. Axios interceptor adds "Authorization: Bearer <token>" to every request
5. On 401 response → clear token, redirect to /login
6. On page reload → GET /api/auth/me with stored token to restore session
```

### 3.4 Key design decisions

- **No participant-facing pages** — `RequireAuth` wraps all routes; there is no registration flow.
- **Inline editing** — `EditableField` component renders a read view and switches to input on click. Saves immediately on confirm.
- **Phone masking in list view** — shows last 4 digits only (`···· 1234`). Full phone shown on profile tab.
- **VITE_API_URL** — the axios base URL becomes `${VITE_API_URL}/api` in production, `/api` in dev (proxied by Vite to localhost:4000).

---

## 4. Backend Architecture

### 4.1 Technology choices

| Choice | Rationale |
|---|---|
| **Express 4** | Minimal, well-understood, large middleware ecosystem |
| **Prisma 5** | Type-safe ORM; migrations as version-controlled SQL; works with Neon |
| **bcryptjs** | Pure-JS bcrypt — no native build step, works on any Node runtime |
| **jsonwebtoken** | Standard JWT; HS256 with `JWT_SECRET` |
| **zod** | Request body validation with typed parse results |
| **xlsx** | Parse `.xlsx` files without native dependencies |
| **multer** | Multipart file upload handling |
| **helmet** | Sets secure HTTP headers in one line |
| **express-rate-limit** | Limits auth endpoints to 20 req / 15 min to slow brute-force |

### 4.2 Directory structure

```
server/src/
├── index.js              # Express app, middleware registration, server start
├── db.js                 # Prisma singleton (getPrisma())
├── middleware/
│   ├── auth.js           # requireAuth: verify JWT → attach req.user
│   └── rbac.js           # requireProgramRoleMin, canAccessParticipant, getCoachGroups
├── routes/
│   ├── auth.js           # POST /login, GET /me, POST /change-password
│   ├── programs.js       # CRUD programs + member management
│   ├── groups.js         # CRUD groups + coach assignment
│   ├── participants.js   # CRUD participants + move/soft-delete
│   ├── projects.js       # Project upsert, updates, comments, photos, videos
│   ├── search.js         # Name search (participant + coach)
│   ├── importRoute.js    # Excel preview + commit
│   └── audit.js          # Audit log viewer
├── services/
│   ├── encryption.js     # AES-256-GCM encrypt/decrypt, HMAC tokens
│   └── audit.js          # Write audit log entries
└── utils/
    ├── asyncHandler.js   # Wraps async routes so errors flow to Express error middleware
    └── upload.js         # multer memory storage (for xlsx) and disk storage (for photos)
```

### 4.3 Request lifecycle

```
HTTP Request
    │
    ▼
helmet()          ← security headers
cors()            ← allow CLIENT_URL origin
express.json()    ← parse body
rate-limit        ← auth endpoints only
    │
    ▼
Route matched
    │
    ├── requireAuth          (verifies JWT, loads user from DB)
    │       │
    │       ├── requireProgramRoleMin('X')   (checks program_roles table)
    │       │       │
    │       │       └── canAccessParticipant  (checks group assignment for coaches)
    │       │
    │       └── Route handler (wrapped in asyncHandler)
    │               │
    │               ├── Zod validation
    │               ├── Prisma query
    │               ├── encrypt/decrypt PII   (via services/encryption.js)
    │               ├── Write audit log       (via services/audit.js)
    │               └── res.json(...)
    │
    ▼ (on any thrown error)
Error middleware → res.status(500).json({ error: 'Internal server error' })
```

### 4.4 Route → file map

| Method | Path | Handler file | Auth required |
|---|---|---|---|
| POST | `/api/auth/login` | auth.js | ✗ |
| GET | `/api/auth/me` | auth.js | ✓ |
| GET | `/api/programs` | programs.js | ✓ |
| POST | `/api/programs` | programs.js | ✓ |
| GET | `/api/programs/:id` | programs.js | ✓ + member |
| POST | `/api/programs/:id/members` | programs.js | ✓ + Program Coach+ |
| GET | `/api/programs/:id/groups` | groups.js | ✓ + member |
| POST | `/api/programs/:id/groups` | groups.js | ✓ + Head Coach+ |
| GET | `/api/programs/:id/participants` | participants.js | ✓ + member |
| POST | `/api/programs/:id/participants` | participants.js | ✓ + member |
| GET | `/api/participants/:id` | participants.js | ✓ + scope check |
| PATCH | `/api/participants/:id` | participants.js | ✓ + scope check |
| PATCH | `/api/participants/:id/move` | participants.js | ✓ + Head Coach+ |
| DELETE | `/api/participants/:id` | participants.js | ✓ + Leader |
| GET/PUT | `/api/participants/:id/project` | projects.js | ✓ + scope check |
| POST | `/api/projects/:id/updates` | projects.js | ✓ + scope check |
| POST | `/api/projects/:id/comments` | projects.js | ✓ + scope check |
| POST | `/api/projects/:id/photos` | projects.js | ✓ + scope check |
| POST | `/api/projects/:id/videos` | projects.js | ✓ + scope check |
| GET | `/api/programs/:id/search` | search.js | ✓ + member |
| POST | `/api/programs/:id/import/preview` | importRoute.js | ✓ + Head Coach+ |
| POST | `/api/programs/:id/import/commit` | importRoute.js | ✓ + Head Coach+ |
| GET | `/api/programs/:id/audit` | audit.js | ✓ + Leader/PC |
| GET | `/api/health` | index.js | ✗ |
| GET | `/api/debug` | index.js | ✗ (remove in production) |

---

## 5. Database Architecture

### 5.1 Entity relationship summary

```
User ──< ProgramRole >── Program ──< Group ──< GroupCoach >── User
                            │             │
                            └──< Participant >── CommunityProject
                                                      │
                                         ┌────────────┼────────────┐
                                    ProjectUpdate   Comment    MediaAsset
                                         │
                                    Comment (threaded)
                                    MediaAsset

AuditLog ──▶ User (actor)
AuditLog ──▶ Participant (subject)
```

### 5.2 Schema highlights

**`participants` table** — all PII columns store base64-encoded ciphertext:
```
firstNameEnc      TEXT    -- AES-256-GCM ciphertext
lastNameEnc       TEXT
phoneEnc          TEXT
familyEnc         TEXT
whatsImportantEnc TEXT
whyJoinedEnc      TEXT
whatAccomplishEnc TEXT
firstNameToken    TEXT    -- HMAC-SHA256(firstName.toLowerCase()) for search
lastNameToken     TEXT    -- HMAC-SHA256(lastName.toLowerCase()) for search
isDeleted         BOOLEAN -- soft delete flag
deletedAt         TIMESTAMP
```

**`program_roles` table** — unique constraint `(program_id, user_id)`:
```
role ENUM: LEADER | PROGRAM_COACH | HEAD_COACH | COACH
```

**`audit_logs` table** — append-only, never updated or deleted:
```
actor_user_id  UUID  -- who did it
action         TEXT  -- CREATE | UPDATE | SOFT_DELETE | MOVE_GROUP | IMPORT | ASSIGN_ROLE
entity         TEXT  -- Program | Group | Participant | CommunityProject | ProgramRole
entity_id      UUID
participant_id UUID  -- links to participant for PII-related logs
before         JSON  -- previous state (nullable)
after          JSON  -- new state (nullable)
```

### 5.3 Migration strategy

- Prisma Migrate manages schema as version-controlled SQL files under `server/prisma/migrations/`
- `prisma migrate deploy` runs pending migrations (safe for production — no auto-reset)
- `prisma db push` is used in early dev for rapid iteration (no migration files generated)
- The Render build command runs `prisma migrate deploy` on every deploy → zero-downtime schema updates

---

## 6. Security Architecture

### 6.1 PII encryption (application-layer)

```
plaintext  →  encrypt()  →  ciphertext stored in DB
ciphertext →  decrypt()  →  plaintext returned to client (after auth + authz)

encrypt(plaintext):
  key  = Buffer.from(ENCRYPTION_KEY, 'hex')   // 32 bytes
  iv   = crypto.randomBytes(12)               // 12-byte random IV per record
  cipher = createCipheriv('aes-256-gcm', key, iv)
  encrypted = cipher.update(plaintext) + cipher.final()
  tag  = cipher.getAuthTag()                  // 16-byte authentication tag
  return base64(iv + tag + encrypted)         // stored as single base64 string

decrypt(ciphertext):
  buf  = base64decode(ciphertext)
  iv   = buf[0:12]
  tag  = buf[12:28]
  data = buf[28:]
  decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)                    // verifies integrity — throws if tampered
  return decipher.update(data) + decipher.final()
```

**Why AES-256-GCM?**
- **Authenticated encryption** — the auth tag detects any tampering with the ciphertext
- **Random IV per record** — same plaintext → different ciphertext each time (no pattern leakage)
- **256-bit key** — exceeds current brute-force feasibility

### 6.2 Search without decrypting all rows

Searching by participant name requires finding rows without decrypting every record. Solution:

```
HMAC-SHA256(lowerCase(firstName), HMAC_KEY) → stored as firstNameToken
HMAC-SHA256(lowerCase(lastName),  HMAC_KEY) → stored as lastNameToken

Search query:
  token = HMAC-SHA256(lowerCase(query), HMAC_KEY)
  SELECT * FROM participants WHERE firstNameToken = token OR lastNameToken = token
```

For partial-name search (e.g. "John" matching "Johnson"), all rows within the user's scope are decrypted in-process and filtered — acceptable for cohorts of ~200 participants.

### 6.3 RBAC model

Permissions are evaluated on every request — not cached — using two checks:

1. **Program-level:** `program_roles` table → `role` for `(program_id, user_id)`
2. **Group-level (for Coach):** `group_coaches` table → list of `group_id` for this coach

```
ROLE_RANK = { LEADER: 4, PROGRAM_COACH: 3, HEAD_COACH: 2, COACH: 1 }

requireProgramRoleMin('HEAD_COACH')
  → fetch role from program_roles
  → check ROLE_RANK[role] >= ROLE_RANK['HEAD_COACH']
  → 403 if not

canAccessParticipant(userId, participant, programRole)
  → if LEADER/PROGRAM_COACH/HEAD_COACH: true
  → if COACH: check participant.groupId ∈ getCoachGroups(userId, programId)
  → else: false
```

### 6.4 JWT sessions

- Algorithm: HS256
- Payload: `{ sub: userId }`
- Expiry: 8 hours
- Storage: `localStorage` (acceptable for internal coaching tool; consider `httpOnly` cookies for higher security)
- Revocation: Not supported in v1 (stateless). Changing `JWT_SECRET` invalidates all sessions.

### 6.5 Soft deletes and audit trail

- Deleting a participant sets `is_deleted = true`, `deleted_at = now()` — record is retained
- All create/update/delete actions on PII write to `audit_logs` with `before`/`after` JSON
- Hard purge (physical delete) is not implemented in v1 — add as a Leader-only operation for DPDP compliance

---

## 7. Excel Import Architecture

### 7.1 Column mapping

The importer maps the 12-column SELP intake sheet format:

| Excel column | DB field |
|---|---|
| First Name | `participant.firstNameEnc` (encrypted) |
| Last Name | `participant.lastNameEnc` (encrypted) |
| Who I am is the possibility of: | `community_projects.who_i_am_possibility` |
| My target community is: | `community_projects.target_community` |
| The possibility of my project is: | `community_projects.project_possibility` |
| My community project is: | `community_projects.project_description` |
| The name of my project is: | `community_projects.project_name` |
| Specific measurable results… | `community_projects.smr_end_of_program` |
| MILESTONE by Workday 3… | `community_projects.milestone_workday3` |
| MILESTONE by Workday 2… | `community_projects.milestone_workday2` |
| Other resources… | `community_projects.promotion_resources` |
| OTHER RESULTS… forum registrations | `community_projects.forum_registrations` |

### 7.2 Import flow

```
POST /api/programs/:id/import/preview   (multipart, dry-run)
  │
  ├── multer reads .xlsx into memory buffer
  ├── xlsx.read() → parse rows
  ├── normalizeRow() → map column names to field keys
  ├── For each row:
  │     HMAC(firstName) + HMAC(lastName) → match against existing participants
  │     → status: CREATE | UPDATE | SKIP
  └── Return { summary, rows[] } — nothing written to DB

POST /api/programs/:id/import/commit   (multipart)
  │
  ├── Same parse + match logic
  ├── For each CREATE row:
  │     encryptParticipant() → insert participants row
  │     insert community_projects row
  ├── For each UPDATE row:
  │     upsert community_projects (project fields only — phone left blank)
  └── Return { created, updated, skipped, errors[] }
```

**Participant matching rule:** HMAC(firstName) + HMAC(lastName) within the same program. Phone is absent from the intake sheet, so imported participants have no phone until manually edited.

---

## 8. Data Flow Diagrams

### 8.1 Login

```
Browser → POST /api/auth/login { email, password }
              │
              ▼
          zod validate
              │
              ▼
          prisma.user.findUnique({ where: { email } })
              │
         ┌────┴────┐
      not found   found
         │           │
      401          bcrypt.compare(password, hash)
                      │
                 ┌────┴────┐
               wrong     correct
                 │           │
               401        jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '8h' })
                              │
                           { token, user } → 200
```

### 8.2 Load participant (Coach)

```
Browser → GET /api/participants/:id  [Bearer token]
              │
          requireAuth → prisma.user.findUnique(token.sub) → req.user
              │
          getProgramRole(user.id, participant.programId)
              │  → 'COACH'
          getCoachGroups(user.id, programId)
              │  → ['group-uuid-1']
          participant.groupId ∈ coachGroups?
              │  → yes
          prisma.participant.findUnique(...)
              │
          decryptParticipant(row)   ← AES-256-GCM decrypt, server-side
              │
          res.json(plaintext)       → 200
```

### 8.3 Create participant (encrypting PII)

```
POST body: { firstName: "Jane", lastName: "Doe", phone: "9876543210" }
              │
          encryptParticipant(data):
            firstNameEnc  = encrypt("Jane")   → base64(iv+tag+ciphertext)
            lastNameEnc   = encrypt("Doe")    → base64(iv+tag+ciphertext)
            phoneEnc      = encrypt("9876543210") → base64(...)
            firstNameToken = HMAC("jane")     → hex string  ← for search
            lastNameToken  = HMAC("doe")      → hex string
              │
          prisma.participant.create({ firstNameEnc, lastNameEnc, phoneEnc, ... })
              │
          audit.log({ action: 'CREATE', after: { firstName: 'Jane', lastName: 'Doe' } })
              │
          decryptParticipant(created) → res.json(plaintext)
```

---

## 9. Local Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A Neon account (free) or local PostgreSQL

### Step-by-step

```bash
# 1. Clone
git clone https://github.com/kpjayanth/selp-tracker
cd selp-tracker

# 2. Generate secret keys
node -e "const c=require('crypto'); console.log('ENCRYPTION_KEY='+c.randomBytes(32).toString('hex')); console.log('HMAC_KEY='+c.randomBytes(32).toString('hex')); console.log('JWT_SECRET='+c.randomBytes(32).toString('hex'))"

# 3. Configure backend
cd server
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, HMAC_KEY

# 4. Install and migrate
npm install
npm run db:generate     # generates Prisma client from schema
npm run db:push         # pushes schema to DB (dev only — use migrate deploy in prod)
npm run db:seed         # creates admin@selp.org / Admin1234!

# 5. Start backend
npm run dev             # nodemon on :4000

# 6. Configure frontend (new terminal)
cd ../client
cp .env.example .env    # VITE_API_URL is optional in dev (proxy handles it)
npm install
npm run dev             # Vite on :5173, proxies /api → localhost:4000
```

Open http://localhost:5173 — login with `admin@selp.org` / `Admin1234!`

### Vite proxy (dev only)

`client/vite.config.js` proxies `/api/*` and `/uploads/*` to `localhost:4000` in dev.
In production, `VITE_API_URL` is baked into the bundle at build time, so axios calls go directly to the Render URL.

---

## 10. Production Deployment Checklist

- [ ] `DATABASE_URL` set in Render with `?sslmode=require`
- [ ] `ENCRYPTION_KEY` is a unique 64-char hex string (never reuse across environments)
- [ ] `HMAC_KEY` is a unique 64-char hex string
- [ ] `JWT_SECRET` is at least 32 random chars
- [ ] `CLIENT_URL` matches your exact Vercel domain (no trailing slash)
- [ ] Render Build Command includes `npx prisma migrate deploy && node prisma/seed.js`
- [ ] `VITE_API_URL` set in Vercel to your Render URL
- [ ] Admin password changed after first login
- [ ] `/api/debug` endpoint removed or protected before going live
- [ ] Neon DB connection string kept secret (never committed to git)
- [ ] Photo storage migrated to Cloudflare R2 before first real cohort (Render disk is ephemeral)

---

## 11. Upgrade Path

| Concern | Current (free) | Upgrade |
|---|---|---|
| File persistence | Render local disk (lost on redeploy) | Cloudflare R2 / AWS S3 |
| API always-on | Render free (sleeps after 15 min) | Render $7/mo starter |
| DB size | Neon 0.5 GB | Neon paid / Railway |
| Key management | Env var (ENCRYPTION_KEY) | AWS KMS envelope encryption |
| MFA | Not implemented | TOTP via `otplib` |
| Email invites | Temp password in UI | SendGrid / Resend |
| Video storage | Links only | Cloudflare Stream |

---

## 12. Known Limitations (v1)

1. **Photo storage is ephemeral** — Render free tier wipes the disk on every deploy. Migrate to object storage before real use.
2. **No email delivery** — new users get a temporary password set in the UI instead of an email invite.
3. **JWT has no revocation** — to log out all sessions, rotate `JWT_SECRET` in Render.
4. **Search decrypts all rows** — partial-name search decrypts every participant in scope. Fine for <500 participants; add a dedicated search index (e.g. trigram index on a shadow table) for larger cohorts.
5. **Single-key encryption** — all records share the same `ENCRYPTION_KEY`. True envelope encryption (per-record data keys wrapped by KMS) is the PRD's target for production.
6. **`/api/debug` endpoint is public** — must be removed or restricted before launch.
