# MediLens — Developer Documentation

> Scan. Understand. Learn.

An educational medicine-information tool that helps users identify medicines
from their packaging and understand verified information about them in their
preferred language.

Read [SAFETY.md](./SAFETY.md) before changing anything in `services/ai`,
`services/identification`, or `services/prescription`.

---

## Contents

1. [Project overview](#project-overview)
2. [Architecture](#architecture)
3. [Project structure](#project-structure)
4. [Installation](#installation)
5. [Environment variables](#environment-variables)
6. [Database setup](#database-setup)
7. [Development commands](#development-commands)
8. [Testing](#testing)
9. [Provider configuration](#provider-configuration)
10. [Admin setup](#admin-setup)
11. [Security notes](#security-notes)
12. [Data-source governance](#data-source-governance)
13. [Production build and deployment](#production-build-and-deployment)
14. [Operational jobs](#operational-jobs)
15. [Known limitations](#known-limitations)

---

## Project overview

MediLens does five things:

| Feature | Entry point |
| --- | --- |
| Scan a medicine package and identify it | `/scan` → `POST /api/scan` |
| Search the medicine database | `/search` → `GET /api/medicines` |
| Read verified medicine information, in 3 languages, aloud | `/medicine/[id]` |
| Extract the text of a prescription (extraction only) | `/prescription` → `POST /api/prescription` |
| Keep a personal medicine history | `/history` → `/api/history` |

Plus an admin area at `/admin` for medicine records, sources, translations, a
review queue, and the audit log.

**It runs with zero credentials.** OCR uses local Tesseract, explanations use a
deterministic non-LLM provider, speech uses the browser, and medicine data
falls back to a bundled demo dataset. Every one of those is a swappable
provider behind an interface.

## Architecture

### Layers

```
app/            Next.js App Router — pages and API route handlers
  └─ thin: parse, authorise, delegate, serialise

features/       Feature UI, one directory per domain (scan, medicine, search, …)
components/     Design system + shared UI, no business logic

services/       All business logic, framework-independent
  ├─ medicine/          repository interface + Prisma and demo implementations
  ├─ identification/    extract → match → confidence  (pure functions)
  ├─ prescription/      verbatim text extraction      (pure functions)
  ├─ ocr/               provider abstraction: tesseract | google | mock
  ├─ ai/                provider abstraction: template | anthropic + safety gate
  ├─ tts/               provider abstraction: browser | server
  ├─ storage/           provider abstraction: local | s3
  ├─ scan/              orchestration: upload → OCR → identify → persist
  └─ admin/             admin write operations and their invariants

lib/            Cross-cutting: db, auth, session, errors, logging, api helpers, i18n
config/         Env validation, app constants, language registry
database/       Prisma schema, migrations, seed, demo dataset
types/          Domain types, independent of Prisma
```

Three rules keep this honest:

- **UI never contains business logic.** A component may call an API route or a
  service; it may not decide what counts as an identified medicine.
- **`services/` never imports from `app/` or `components/`.**
- **No root `app/loading.tsx`.** It wraps every route in a Suspense boundary.
  With async server pages that produced an unbalanced SSR stream — four
  streamed segments but only three reveal scripts — so one segment was never
  reconciled and stayed in the DOM holding a full second copy of the header,
  `<main>` and page content. Give a route its own `<Suspense>` when it needs a
  loading state (`/search` and `/auth/reset-password` do); do not add a global
  one.

### One container for the whole app shell

`container-page` (64rem) is the single measure for the header, navigation,
`<main>` and footer. They must not diverge: the header previously used
`container-wide` (80rem) while `<main>` used 48rem, which left the logo and the
page heading 256px out of alignment on a laptop. `container-wide` is for the
admin area only, where data tables need the extra room.

### The safety-critical data flow

```
image → OCR (verbatim) → extract fields → match catalogue → confidence gate
      → verified record → AI simplification/translation → user
```

The AI layer receives only a verified record built by `toVerifiedContext()`. It
never sees the image or the raw OCR text, and it cannot add a medical fact that
is not in the record. See [SAFETY.md §3](./SAFETY.md#3-the-data-flow-rule).

### Repository abstraction

`MedicineRepository` (`services/medicine/repository.ts`) has two
implementations:

- `PrismaMedicineRepository` — PostgreSQL, used when `DATABASE_URL` is set.
- `DemoMedicineRepository` — the bundled sample dataset, used when it is not.

`getMedicineRepository()` picks one, and `repository.isDemo` tells callers which
they got.

Demo status is **not** shown to normal users as a banner. Honesty is carried
where it is actionable instead: every demo record stays `UNVERIFIED`, the
medicine page shows a "Not yet verified" badge and names the source as
"Demo seed data — not a verified medical source", and the admin overview warns
while `NEXT_PUBLIC_DEMO_MODE` is true. A record can never be published without
being verified against a non-demo source, so sample data cannot be presented as
verified medical information.

## Project structure

```
app/
  api/            REST endpoints (scan, medicines, ai, history, auth, admin, health)
  admin/          Admin area — (dashboard)/ is the guarded segment
  legal/          Privacy, terms, medical disclaimer
  medicine/[id]/  Medicine information page (server-rendered)
  scan/           Scanner and result pages
components/
  ui/             Button, Card, Alert, Badge, Form, Modal, states, icons
  layout/         AppShell, navigation, language switcher
config/           app.ts, env.ts, languages.ts
database/
  schema.prisma   15 models
  data/           demo-medicines.ts (DEMO ONLY, always UNVERIFIED)
  seed.ts
docs/             README.md, SAFETY.md
features/         home, scan, medicine, search, prescription, history, account,
                  settings, admin
hooks/            use-camera, use-speech, use-api
lib/              api, auth, audit, crypto, db, errors, logger, rate-limit,
                  schemas, session, system-log, upload, i18n/
public/           icons, robots.txt
scripts/          create-admin.ts, purge-expired-uploads.ts
services/         see Architecture
tests/            unit, integration, api, safety, ui
types/            medicine.ts, identification.ts
utils/            text, format, image, cn
```

## Installation

Requires **Node 20.9+** (Node 24 recommended) and npm 10+.

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run dev
```

Open <http://localhost:3000>. With no `.env.local` values filled in, the app
runs against the demo dataset with local OCR — the full scan flow works.

> On npm 12+, package install scripts are blocked by default. If
> `npm run db:generate` fails, run
> `npm install-scripts approve prisma @prisma/engines esbuild unrs-resolver`.

## Environment variables

Every variable is validated by Zod at boot (`config/env.ts`) — a bad value
fails fast with a readable message rather than at request time. Full list with
comments: [`.env.example`](../.env.example).

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | *(empty)* | Empty ⇒ read-only demo dataset, accounts and admin disabled |
| `SESSION_SECRET` | *(empty)* | ≥ 32 chars. Required for accounts and admin |
| `SESSION_MAX_AGE` | `604800` | Session lifetime, seconds |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `true` ⇒ the admin overview warns that demo data is in use |
| `OCR_PROVIDER` | `tesseract` | `tesseract` \| `google` \| `mock` |
| `OCR_LANGUAGES` | `eng` | Comma-separated Tesseract codes, e.g. `eng,hin` |
| `GOOGLE_VISION_API_KEY` | *(empty)* | Required only for `OCR_PROVIDER=google` |
| `AI_PROVIDER` | `template` | `template` (no credentials) \| `anthropic` |
| `ANTHROPIC_API_KEY` | *(empty)* | Required only for `AI_PROVIDER=anthropic` |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | |
| `TRANSLATION_PROVIDER` | `stored` | `stored` (reviewed only) \| `ai` |
| `TTS_PROVIDER` | `browser` | `browser` (Web Speech API) \| `server` (not implemented) |
| `STORAGE_PROVIDER` | `local` | `local` (dev only) \| `s3` (not implemented) |
| `MAIL_PROVIDER` | `none` | `none` (nothing sent, UI says so) \| `dev` (writes to `./.dev-mail/`) \| `resend` |
| `MAIL_FROM` | *(empty)* | Required only for `MAIL_PROVIDER=resend` |
| `RESEND_API_KEY` | *(empty)* | Required only for `MAIL_PROVIDER=resend` |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | Reset-link lifetime |
| `UPLOAD_RETENTION_HOURS` | `24` | Retention for opted-in images |
| `MAX_UPLOAD_BYTES` | `8388608` | 8 MB |
| `RATE_LIMIT_*` | `60` / `30` | Window seconds / requests |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Never commit a filled-in `.env`. No secret is ever read from client code — every
secret-bearing module imports `server-only`, which makes a client import a build
error.

## Database setup

PostgreSQL 14+ with Prisma 7. Prisma 7 uses a driver adapter, so the connection
URL lives in `prisma.config.ts` (CLI) and `lib/db.ts` (runtime), not in the
schema file.

### Option A — local Prisma Postgres (no Docker)

```bash
npx prisma dev --name medilens
```

Copy the printed `DATABASE_URL` (and `SHADOW_DATABASE_URL`) into `.env.local`.
The server must stay running while you use the app, and it allocates a fresh
port each time it starts — re-copy the URL after restarting it.

### Option B — Docker

```bash
docker compose up -d db
# DATABASE_URL=postgresql://medilens:medilens@localhost:5432/medilens
```

### Option C — any managed PostgreSQL

Set `DATABASE_URL` to its connection string.

### Then

```bash
npm run db:migrate      # development: create and apply a migration
npm run db:seed         # languages + the demo dataset
npm run db:studio       # browse the data
```

For an existing deployment:

```bash
npm run db:migrate:deploy
```

### Schema notes

15 models. The ones worth knowing:

- `Medicine` — the single source of truth. Unique on
  `(brandName, strength, dosageForm, manufacturer)` so the same product cannot
  be entered twice. `status` controls visibility; `verificationStatus` controls
  trust. They are deliberately separate.
- `MedicineSource` — every record must have at least one.
- `MedicineTranslation` — per-language content with its own review status, so an
  unreviewed machine translation can never look verified.
- `MedicineScan` / `ScanResult` — `rawOcrText` is stored separately from the
  interpreted `extracted*` fields and is never overwritten.
- `PrescriptionScan` / `PrescriptionLine` — `rawText` verbatim, `detectedFrequency`
  copied as written.
- `AuditLog` — append-only. There is no API that edits or deletes it.
- `SystemErrorLog` — operational errors, kept separate from the security trail.

## Development commands

```bash
npm run dev              # dev server
npm run build            # production build
npm start                # serve the production build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # vitest, single run
npm run test:watch
npm run db:generate      # regenerate the Prisma client
npm run db:migrate       # create + apply a migration
npm run db:seed
npm run admin:create     # bootstrap an administrator
```

## Testing

```bash
npm test
```

217 tests across five suites:

| Suite | What it covers |
| --- | --- |
| `tests/unit/` | Text normalisation, field extraction, matcher scoring and confidence caps, translation resolution, prescription extraction, upload validation, rate limiting, log redaction, crypto helpers |
| `tests/safety/` | **The refusal contract.** Every question from specification §37, in three languages, plus output filtering and prompt-injection attempts |
| `tests/integration/` | The whole read path: OCR → extract → match → localise → explain → speech script, against the demo repository |
| `tests/api/` | Route handlers: validation, rate limits, 401 on every admin and history endpoint, cross-origin rejection, no raw exception text in responses |
| `tests/ui/` | Accessibility and safety of rendered output: labelled fields, `role="alert"`, colour never the only signal, and that a non-`HIGH` result never renders as "identified" |

The suite forces the no-database, no-credentials configuration in `tests/setup.ts` (it deletes `DATABASE_URL` so a developer's `.env.local` cannot change what CI runs) — the same configuration a
contributor gets on a fresh clone. UI tests opt into jsdom with a
`// @vitest-environment jsdom` docblock.

## Provider configuration

### OCR

| Provider | Credentials | Notes |
| --- | --- | --- |
| `tesseract` *(default)* | none | Runs on the server. Downloads ~4 MB of language data on first use and caches it — pre-seed that cache for an air-gapped deployment |
| `google` | `GOOGLE_VISION_API_KEY` | Cloud Vision `DOCUMENT_TEXT_DETECTION`. Better on handwriting |
| `mock` | none | Fixed fixture. Tests only |

Adding a provider: implement `OcrProvider` (`services/ocr/types.ts`) and add it
to the factory in `services/ocr/index.ts`. Nothing else changes.

### AI

| Provider | Credentials | Notes |
| --- | --- | --- |
| `template` *(default)* | none | Deterministic. Assembles sentences from verified fields — structurally cannot hallucinate. Cannot translate |
| `anthropic` | `ANTHROPIC_API_KEY` | Claude. `temperature: 0`, safety-constrained system prompt, screened before and after the call |

If `AI_PROVIDER=anthropic` is set without a key, the factory logs a warning and
falls back to `template` rather than failing at request time.

### Text to speech

`browser` uses the Web Speech API — no audio leaves the device and no medical
text is sent to a third party. If the device has no voice for the selected
language, the UI says so rather than reading Marathi with an English voice.
`buildSpeechScript()` includes only user-facing content; ids, scores, source
URLs and verification status are excluded.

### Storage

`local` writes to `STORAGE_LOCAL_DIR` with mode `0600` and is development-only.
`s3` is wired but **not implemented** — its methods throw rather than pretending
to have stored something. Implementing it is a single-file change; also add a
bucket lifecycle rule matching `UPLOAD_RETENTION_HOURS`.

## Accounts and password reset

Accounts are optional — scanning, search, prescription extraction and speech all
work as a guest. An account only adds a history that follows the user between
devices.

### Screens

| Route | Purpose |
| --- | --- |
| `/profile` | Signed out, this **is** the sign-in screen. Signed in, it shows the account |
| `/auth/sign-up` | Create an account. Password rules are visible and tick off live |
| `/auth/forgot-password` | Request a reset code, enter it, then choose a new password |
| `/auth/sign-in` | Redirect to `/profile`, so the conventional path still works |

Sign-in, sign-up and sign-out all finish with a **full navigation**, not
`router.refresh()`. A session change has to re-render every server component
that read the cookie; a refresh alone left the previous state on screen.

### Creating a test account

Use the sign-up form at `/auth/sign-up`, or the API:

```bash
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d '{"email":"you@example.com","password":"AtLeastTwelve1"}'
```

Passwords need 12+ characters with an upper-case letter, a lower-case letter and
a number. They are stored as bcrypt hashes at cost 12 — never in plain text.

### Password reset

Reset uses a **6-digit code** emailed to the account holder. The code is stored
only as `sha256(userId:code)`, valid for `PASSWORD_RESET_TTL_MINUTES`
(10 by default), and **single use**. Requesting a new code invalidates any
outstanding one, and completing a reset revokes every existing session for that
account. The code is verified against the account (email + code) — a bare
six-digit code identifies no one — and verifying and completing answer
identically for a wrong code and an unknown address.

`/api/auth/forgot-password` answers identically whether or not the address is
registered, so it cannot be used to discover who has an account.

Delivery depends on `MAIL_PROVIDER`, and the UI states plainly what happened:

| `MAIL_PROVIDER` | Behaviour | UI message |
| --- | --- | --- |
| `none` *(default)* | Nothing is sent | "Email delivery is not set up on this installation, so no email was sent." |
| `dev` | Message written to `./.dev-mail/` | "Development mode: no email was sent." |
| `resend` | Real email via Resend | "If an account exists for that address, a 6-digit reset code is on its way." |

**Local development.** Set `MAIL_PROVIDER=dev` in `.env.local`, request a reset,
then read the newest code:

```bash
npm run dev:reset-code
```

`.dev-mail/` is gitignored and its files are written `0600`. The reset code is
deliberately **not** returned by the API and **not** written to the application
log — the log records only the file name — so a code cannot leak through a
response body, a log shipper, or an error message.

**Production.** Set `MAIL_PROVIDER=resend`, `RESEND_API_KEY` and `MAIL_FROM`.
Any other provider is one class implementing `Mailer`
(`services/mailer/types.ts`) plus a line in the factory.

Expired and spent tokens are cleaned up by `purgeResetTokens()` in
`services/auth/password-reset.ts`.

## Admin setup

```bash
export ADMIN_BOOTSTRAP_EMAIL=you@example.com
export ADMIN_BOOTSTRAP_PASSWORD='a-long-password-With1'
npm run admin:create
```

Then sign in at `/admin/login`. The password is read from the environment, not
an argument, so it does not land in shell history or another user's process
list.

The admin area needs both `DATABASE_URL` and `SESSION_SECRET`; without them it
renders an explanatory page instead of a broken dashboard. Access is enforced in
two independent places: the `(dashboard)` layout redirects humans, and every
`/api/admin/*` handler calls `requireAdmin()`. The layout is convenience; the
API check is the boundary.

## Security notes

| Control | Where |
| --- | --- |
| Password hashing | bcrypt, 12 rounds (`lib/crypto.ts`) |
| Sessions | Signed JWT cookie carrying a random token; only the token's SHA-256 is stored, so a database leak alone cannot be replayed |
| Cookies | `httpOnly`, `sameSite=lax`, `secure` in production |
| Authorisation | `requireUser` / `requireAdmin` / `requireSuperAdmin` in every handler |
| IDOR | Scans and history rows are always scoped to the owner; a foreign id returns 404, not 403 |
| Login timing | A missing account still runs a bcrypt comparison |
| Rate limiting | Per-route, per-user-or-IP. Sign-in 8/5 min, scan 10/min, AI 20/min |
| CSRF | `sameSite=lax` plus an explicit origin check on every write |
| Upload validation | Magic-byte sniffing; the declared MIME type is never trusted. SVG and HTML rejected |
| Input validation | Zod on every route, server-side; oversized bodies rejected before parsing |
| SQL injection | Prisma parameterised queries throughout |
| XSS | React escaping; no `dangerouslySetInnerHTML` anywhere |
| Secure headers | `next.config.ts` — HSTS, `X-Frame-Options: DENY`, `nosniff`, tight `Permissions-Policy`, `no-store` on APIs |
| Secret isolation | `server-only` on every module that touches a secret |
| Error handling | `AppError` → stable code + safe message; raw exceptions never reach the client |
| Audit logging | Every admin action, login, and account deletion |
| Log hygiene | Automatic redaction of credentials, OCR text, prescription content, emails |

`tests/unit/security.test.ts` and the authorisation block in
`tests/api/routes.test.ts` cover these.

## Data-source governance

See [SAFETY.md §4](./SAFETY.md#4-verified-source-requirement). In short: every
record needs a source; `VERIFIED` requires a non-demo source; `PUBLISHED`
requires `VERIFIED`; editing content resets verification. The admin UI surfaces
all four states, and the review queue lists records awaiting verification,
unreviewed translations, uncertain identifications, OCR failures and system
errors.

**Uncertain identifications are the most valuable queue** — they are the direct
signal of a gap in the medicine database.

## Production build and deployment

```bash
npm run build
npm start
```

The build is a standard Next.js server build; any Node host works (Vercel, a
container, a VM).

### Pre-launch checklist

The admin overview renders this live via `assertProductionReady()`:

- [ ] `DATABASE_URL` set and migrated (`npm run db:migrate:deploy`)
- [ ] `SESSION_SECRET` set, ≥ 32 random characters
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` — **only** after verified records replace the
      demo dataset
- [ ] Demo records removed or archived
- [ ] `STORAGE_PROVIDER=s3` implemented and configured, with a lifecycle rule
- [ ] `scripts/purge-expired-uploads.ts` scheduled
- [ ] TLS terminated in front of the app (HSTS is already sent)
- [ ] Rate limiter moved to Redis if running more than one instance —
      `lib/rate-limit.ts` is in-memory and per-instance
- [ ] Privacy policy and terms completed with real contact details and a
      grievance officer
- [ ] **Regulatory review completed** — see [SAFETY.md §11](./SAFETY.md#11-regulatory-position)

### PWA assets

`app/manifest.webmanifest/route.ts` serves the manifest and references
`/icons/icon.svg` and `/icons/icon-maskable.svg`. Rasterise 192 px and 512 px
PNGs before store submission; some install flows still prefer PNG.

The service worker (`app/sw.js/route.ts`) caches **only** the app shell and
static assets. No API response, medicine record, or scan result is ever cached —
MediLens does not claim offline medicine data.

## Operational jobs

```bash
npx tsx scripts/purge-expired-uploads.ts
```

Deletes images past their retention window, clears their keys, and removes
expired sessions. Run it at least hourly. This is a privacy commitment, not
housekeeping: if it never runs, retained images outlive the window promised in
the privacy policy.

## Known limitations

- **S3 storage is not implemented.** The interface and configuration exist; the
  methods throw. Local storage is development-only.
- **Server-side TTS is not implemented.** `TTS_PROVIDER=server` falls back to the
  browser.
- **The rate limiter is in-memory.** Correct for a single instance; move to
  Redis behind the same interface for a multi-instance deployment.
- **`listForMatching()` loads the published catalogue** (capped at 5000 rows).
  Beyond a few thousand records, add a trigram-indexed SQL prefilter — the
  matcher only needs to be handed candidate rows.
- **Barcode scanning is an abstraction, not a scanner.** `MedicineBarcode` and
  the matcher hook exist; there is no camera barcode reader in v1, and a
  barcode alone can never confirm a medicine.
- **Interaction checking is deliberately absent** and questions about it are
  redirected. Do not add it without an authoritative interaction database.
- **Tesseract needs network access on first use** to fetch language data.
