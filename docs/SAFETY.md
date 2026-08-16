# MediLens — Safety Model

This document is the authoritative statement of what MediLens does, what it
refuses to do, and where each rule is enforced in code. If a change to the
product conflicts with this document, the document wins.

---

## 1. What MediLens is

> An educational medicine-information tool that helps users identify medicines
> from their packaging and understand verified information about them in their
> preferred language.

It reads packaging, matches it against a governed medicine database, and
presents information from that database in the user's language, in text and
speech.

## 2. What MediLens is not

MediLens is **not** a doctor, a diagnostic system, a prescribing system, a
treatment planner, or an emergency service. Specifically, it must never:

| Prohibited | Enforced by |
| --- | --- |
| Diagnose a condition | `services/ai/safety.ts` → `DIAGNOSIS` rule |
| Recommend or prescribe a medicine for a person | `PERSONAL_SUITABILITY` rule |
| Tell someone to start, stop, or change a medicine | `STOP_OR_CHANGE` rule |
| Give a dose, frequency, or duration for a person | `DOSAGE_ADVICE` rule + `screenAnswer` output filter |
| Say a medicine is safe or suitable for a person | `PERSONAL_SUITABILITY` rule |
| Predict a person's future health | `PROGNOSIS_PREDICTION` rule |
| Check medicine interactions | `INTERACTION_ADVICE` rule (v1 has no interaction database) |
| Handle a medical emergency | `EMERGENCY` rule → redirects to emergency services |
| Invent a medical fact | Provider architecture, §4 below |
| Guess an unidentified medicine | `services/identification/match.ts` |
| Present uncertainty as fact | Confidence gating, §5 below |

Every row has a test in `tests/safety/ai-safety.test.ts`. A failure there is a
product-safety defect.

## 3. The data-flow rule

The language model is **never** the source of truth.

```
USER IMAGE
    ↓
OCR / IMAGE PROCESSING          services/ocr/*          raw text, preserved verbatim
    ↓
FIELD EXTRACTION                services/identification/extract.ts
    ↓
DATABASE MATCHING               services/identification/match.ts
    ↓
CONFIDENCE / VERIFICATION       config/app.ts thresholds
    ↓
TRUSTED MEDICINE DATA           services/medicine/repository.ts
    ↓
AI SIMPLIFICATION / TRANSLATION services/ai/*           input is the verified record only
    ↓
USER
```

Two structural guarantees hold this together:

1. **The AI only ever receives a verified record.** `toVerifiedContext()` in
   `services/ai/index.ts` builds the entire model input. It cannot include the
   scan image, the raw OCR text, unverified candidate data, user history, or
   anything else. If a fact is not in the record, the model has not seen it.
2. **The default provider cannot hallucinate at all.** `TemplateAiProvider` is
   the default (`AI_PROVIDER=template`). It assembles sentences from verified
   fields plus fixed connective phrases. It generates no free text, so MediLens
   works safely with no AI credentials configured.

When `AI_PROVIDER=anthropic` is configured, the same guarantees are enforced by
three layers: the system prompt (`services/ai/prompts.ts`), the pre-call
question screen, and the post-call answer screen.

## 4. Verified-source requirement

- Every medicine record must have at least one `MedicineSource`.
- A record cannot be marked `VERIFIED` unless it has a source that is **not**
  `DEMO_SEED_DATA` — see `app/api/admin/medicines/[id]/verify/route.ts`.
- A record cannot be `PUBLISHED` unless it is `VERIFIED` and has a non-demo
  source — see `assertPublishable()` in `services/admin/medicine-admin.ts`.
- Editing content resets `verificationStatus` to `PENDING_REVIEW` and clears
  `lastVerifiedAt`, so edited text can never keep an older approval.
- The medicine page always shows the source, its category, and the last
  verification date — or states plainly that the record is not yet verified.

Acceptable source categories: government/regulatory, official product
documentation, an authoritative drug-information database, or manufacturer
documentation. **Do not** scrape general websites and treat the result as
medical truth. **Do not** use LLM-generated content as the medicine database.

## 5. Identification confidence

Thresholds live in `config/app.ts`:

| Level | Score | Presented as |
| --- | --- | --- |
| `HIGH` | ≥ 0.85 | Identified — only this level sets `confirmedMedicineId` |
| `MEDIUM` | ≥ 0.60 | "We found several possible matches" — user must check the pack |
| `LOW` | ≥ 0.30 | "Medicine identification is uncertain" — asks for a clearer image |
| `NOT_IDENTIFIED` | < 0.30 | "We could not identify this medicine" |

Additional hard rules in `services/identification/match.ts`:

- **Ambiguity blocks confirmation.** If the runner-up is within
  `MIN_LEAD_OVER_RUNNER_UP` (0.12), a `HIGH` result is demoted to `MEDIUM` and
  reported as multiple matches. Two look-alike medicines are never silently
  resolved.
- **A contradicting strength caps the score at 0.55.** "Dolo 500" and
  "Dolo 650" are different products.
- **A contradicting dosage form caps the score at 0.60.**
- **No brand evidence caps the score below `HIGH`.** However well the
  ingredient, strength, form and manufacturer line up, an unread brand means
  the user is asked to verify against the pack.
- **A barcode alone never confirms.** A barcode hit must be corroborated by the
  pack text (§46 of the specification).
- **User corrections are not a bypass.** Values corrected on the confirmation
  screen re-enter the same matcher and face the same thresholds.

## 6. Prescription handling

Prescription scanning is **information extraction only**.

- `rawText` is stored and displayed exactly as OCR read it, never corrected.
- Frequency text is copied verbatim. `1-0-1 x 5 days` is never expanded into an
  instruction.
- A medicine name is only separated out when the line was read above the
  confidence floor **and** the remainder looks like a name. Otherwise the field
  is `null` and the line is flagged as needing verification.
- Below the page legibility floor, no line breakdown is produced at all and the
  user is told the handwriting could not be read reliably.
- A line that could not be read is **kept and flagged**, never silently dropped
  — hiding a medicine is worse than showing an unclear one.
- Every response and every screen carries: *"Please verify prescription
  information with your doctor or pharmacist. MediLens does not prescribe or
  modify medicines."*

Thresholds: `LINE_CONFIDENCE_FLOOR = 0.7`, `PAGE_LEGIBILITY_FLOOR = 0.45`.

## 7. Translation safety

- Verified English content is the canonical record; translations live in
  `MedicineTranslation` with their own review status.
- A `REJECTED` translation is never shown.
- An unreviewed machine translation is labelled as such on the page.
- When no translation exists, the English original is shown with an explicit
  notice — MediLens never leaves a section blank and never machine-translates
  on the fly into a page that looks verified.
- The AI translation path rejects any output that changes the number of items
  in a list, since that means a warning was added or dropped.

## 8. Privacy commitments enforced in code

- Uploaded images are **not stored** unless the user opts in
  (`saveScanImages`, off by default). Otherwise they exist only for the
  duration of the request.
- Opted-in images expire after `UPLOAD_RETENTION_HOURS` and are removed by
  `scripts/purge-expired-uploads.ts`.
- Account deletion removes history, scans, prescription scans, and every stored
  image before deleting the user row.
- `lib/logger.ts` redacts anything matching password / token / OCR text /
  prescription / image / email at any depth, and truncates long strings.
- The admin review queue shows failure codes and counts, never OCR text or
  image references.
- Private medical images are never used to train models.

## 9. Demo-data marking

Sample medicine data must never read as verified medical information. That is
enforced by the record itself rather than by a page-level banner:

- Demo records are always `UNVERIFIED` with a `DEMO_SEED_DATA` source, and the
  seed script cannot produce anything else.
- The medicine page shows a "Not yet verified" badge in place of a verification
  date, and names the source as "Demo seed data — not a verified medical
  source".
- A record cannot be marked `VERIFIED` without a non-demo source, and cannot be
  `PUBLISHED` without being `VERIFIED` (§4).
- The admin overview warns for as long as `NEXT_PUBLIC_DEMO_MODE` is true, and
  the production-readiness checklist lists it as a blocker.

The former full-width DEVELOPMENT / DEMO banner on user-facing pages was
removed; none of the guarantees above depend on it.

## 10. Language MediLens must not use

Never claim, in the product or its marketing, that MediLens is an "AI doctor",
"your personal doctor", "guaranteed accurate", "100% safe", that it "predicts
side effects", "prevents disease", "prescribes", or "diagnoses".

## 11. Regulatory position

This safety model is an engineering control, not a legal opinion. Before any
public or commercial launch, MediLens must be reviewed against applicable
Indian healthcare, medical-device, privacy, consumer-protection and advertising
requirements by an appropriately qualified professional. The medical disclaimer
alone does not make the product compliant.

## 12. Conflict rule

If user convenience, feature completeness, or apparent AI capability ever
conflicts with medical safety, **choose medical safety.**
