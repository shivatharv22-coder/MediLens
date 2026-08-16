<div align="center">

# MediLens

### Scan. Understand. Learn.

An educational medicine-information tool that helps users identify medicines
from their packaging and understand verified information about them in their
preferred language.

</div>

---

> [!IMPORTANT]
> **MediLens is not a doctor.** It does not diagnose, prescribe, or recommend
> starting, stopping, or changing any medicine, and it is not a substitute for
> advice from a qualified doctor or pharmacist. It is an educational tool.
> See [Medical disclaimer](#medical-disclaimer) and [docs/SAFETY.md](docs/SAFETY.md).

---

## What it does

Photograph a medicine pack. MediLens reads the text on it, matches it against a
governed medicine database, and shows verified educational information in
English, Hindi or Marathi — in text, or read aloud.

If it cannot confidently identify the medicine, **it says so**. It never guesses.

## Features

- **Scan medicine packaging** — camera or gallery, with framing guidance for
  strips, boxes and liquid bottles. Crop, review what was read, correct it, and
  re-run the match.
- **Confidence-gated identification** — a medicine is only presented as
  identified at high confidence with a clear lead over the runner-up. Anything
  else shows candidates and asks the user to check the pack.
- **Verified medicine information** — what it is, common uses, how it generally
  works, common side effects, important warnings, who needs extra caution,
  storage, manufacturer, source, and the date it was last verified.
- **Search** by brand, generic name, active ingredient or manufacturer.
- **Prescription text extraction** — reads a prescription and shows the text
  verbatim. It does not interpret, correct, or act on it.
- **Three languages** — English, Hindi, Marathi, throughout the interface,
  the medicine content, and the voice output. Adding a fourth is three files.
- **Listen** — play, pause and stop, using the device's own voices.
- **Ask about a medicine** — answered only from the verified record on the page;
  personalised medical questions are declined and redirected.
- **History** — save medicines you have looked at, search it, delete any item or
  all of it.
- **Accounts** — optional email + password sign-in, with a secure password-reset
  flow using single-use, expiring tokens. Nothing is emailed unless a real
  provider is configured, and the UI says so plainly when it is not.
- **Admin** — medicine records, sources, translations, a review queue, and an
  append-only audit log.
- **PWA** — installable, mobile-first, offline app shell (medicine data is
  deliberately *not* cached offline).

## Try it in two minutes

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run dev
```

No database, no API keys. The scanner works — OCR runs locally — and medicine
data comes from a demo dataset. Those records stay `UNVERIFIED`: each medicine
page shows a "Not yet verified" badge and names its source as demo seed data, so
sample content is never presented as verified medical information.

## Architecture

```
image → OCR (verbatim) → extract fields → match catalogue → confidence gate
      → verified record → AI simplification / translation → user
```

The load-bearing rule: **the language model is never the source of medical
truth.** It receives a verified database record and may only simplify,
translate or summarise it. The default AI provider is not a model at all — it
assembles sentences from verified fields, so it cannot hallucinate.

Everything external is a provider behind an interface: OCR, AI, translation,
speech, storage, and the medicine repository itself. Swapping Tesseract for
Cloud Vision, or the demo dataset for PostgreSQL, is a factory change.

```
app/         pages + API routes (thin)
features/    feature UI          components/  design system
services/    all business logic  lib/         db, auth, errors, i18n, api
database/    Prisma schema + seed             types/  domain types
```

Full detail: [docs/README.md](docs/README.md).

## Technology

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
PostgreSQL · Prisma 7 · Zod 4 · jose + bcrypt · Tesseract.js · Vitest

## Setup

Node 20.9+ required.

| Step | Command |
| --- | --- |
| Install | `npm install` |
| Configure | `cp .env.example .env.local` |
| Generate client | `npm run db:generate` |
| Run | `npm run dev` |

## Environment variables

All validated at boot; a bad value fails immediately with a readable message.
Full annotated list in [`.env.example`](.env.example).

The ones that matter:

```bash
DATABASE_URL=            # empty ⇒ demo dataset, accounts and admin disabled
SESSION_SECRET=          # 32+ random chars; required for accounts and admin
NEXT_PUBLIC_DEMO_MODE=true

OCR_PROVIDER=tesseract   # tesseract (no key) | google | mock
AI_PROVIDER=template     # template (no key)  | anthropic
TTS_PROVIDER=browser
STORAGE_PROVIDER=local
```

No secret is reachable from client code — every secret-bearing module imports
`server-only`, which turns a client import into a build error.

## Database

PostgreSQL with Prisma. Start one however you like:

```bash
npx prisma dev                    # local Prisma Postgres, no Docker
docker compose up -d db           # or Docker
```

Then:

```bash
npm run db:migrate      # create and apply migrations
npm run db:seed         # languages + demo dataset (always UNVERIFIED)
npm run admin:create    # bootstrap an administrator
```

Fifteen models. `Medicine` is the single source of truth; `status` controls
visibility and `verificationStatus` controls trust, deliberately separately. A
record cannot be published without being verified, and cannot be verified
without a non-demo source.

## Development

```bash
npm run dev          npm run build        npm start
npm run typecheck    npm run lint         npm test
```

## Testing

```bash
npm test
```

**217 tests**, no database or credentials required:

- `tests/unit/` — extraction, matching and confidence caps, translation
  resolution, prescription parsing, upload validation, rate limiting, log
  redaction, password policy, mail delivery honesty
- `tests/safety/` — the refusal contract, in three languages, plus output
  filtering and prompt-injection attempts
- `tests/integration/` — the full read path against the demo repository
- `tests/api/` — validation, rate limits, 401 on every protected endpoint,
  cross-origin rejection, no raw exception text in responses
- `tests/ui/` — accessibility, and that a non-high-confidence result never
  renders as "identified"

## Deployment

```bash
npm run build && npm start
```

Any Node host. The admin overview renders a live production-readiness checklist;
work it to zero before launch. Highlights: real `SESSION_SECRET`, migrations
applied, `NEXT_PUBLIC_DEMO_MODE=false` **only** once verified records replace
the demo data, S3 storage implemented, the retention job scheduled, and the
rate limiter moved to Redis if running more than one instance.

## Safety

MediLens will not:

diagnose · prescribe · recommend a medicine for a person · tell anyone to start,
stop or change a medicine · give a personal dose · say a medicine is safe for
someone · predict future health · check drug interactions · guess an
unidentified medicine · state a medical fact that is not in its database

These are enforced in code, not just in a prompt: a question screen before
generation, an output screen after it, confidence caps in the matcher, and a
provider architecture that only ever hands the model verified data.

Read [docs/SAFETY.md](docs/SAFETY.md) before touching `services/ai`,
`services/identification`, or `services/prescription`.

## Privacy

Scanned images are **not stored** unless the user opts in; opted-in images
expire and are purged on a schedule. Account deletion removes history, scans and
every stored image. Logs automatically redact credentials, OCR text,
prescription content and emails. Speech synthesis runs on the device. Private
medical images are never used to train models.

## Regulatory note

MediLens has **not** completed a regulatory review. Before any public or
commercial launch it must be assessed against applicable Indian healthcare,
medical-device, privacy, consumer-protection and advertising requirements by an
appropriately qualified professional. A disclaimer alone does not make a product
compliant.

## Medical disclaimer

MediLens provides educational information about medicines. It does not diagnose
medical conditions, does not prescribe medicines, and does not recommend
starting, stopping, or changing any medication. Identification from a photograph
can be wrong — always verify against the packaging or with a pharmacist. For any
personal medical decision, consult a qualified doctor or pharmacist. **In an
emergency, contact your local emergency medical service immediately.**
