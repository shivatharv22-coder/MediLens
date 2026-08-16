-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "MedicineStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DosageForm" AS ENUM ('TABLET', 'CAPSULE', 'ORAL_SUSPENSION', 'ORAL_SOLUTION', 'SYRUP', 'INJECTION', 'TOPICAL_CREAM', 'TOPICAL_OINTMENT', 'TOPICAL_GEL', 'EYE_DROPS', 'EAR_DROPS', 'NASAL_SPRAY', 'INHALER', 'POWDER', 'GRANULES', 'SUPPOSITORY', 'PATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('GOVERNMENT_REGULATORY', 'OFFICIAL_PRODUCT_DOCUMENTATION', 'AUTHORITATIVE_DRUG_DATABASE', 'MANUFACTURER_DOCUMENTATION', 'ACADEMIC_REFERENCE', 'DEMO_SEED_DATA');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NOT_IDENTIFIED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('MEDICINE_PACKAGE', 'PRESCRIPTION', 'BARCODE');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('UPLOADED', 'OCR_RUNNING', 'OCR_FAILED', 'MATCHING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('MACHINE_UNREVIEWED', 'HUMAN_REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'MEDICINE_CREATE', 'MEDICINE_UPDATE', 'MEDICINE_PUBLISH', 'MEDICINE_ARCHIVE', 'MEDICINE_VERIFY', 'SOURCE_CREATE', 'SOURCE_UPDATE', 'TRANSLATION_CREATE', 'TRANSLATION_UPDATE', 'TRANSLATION_REVIEW', 'USER_DELETE', 'HISTORY_CLEAR', 'ADMIN_CREATE', 'SETTINGS_UPDATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "saveScanImages" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "largeText" BOOLEAN NOT NULL DEFAULT false,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supported_languages" (
    "code" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "speechLocale" TEXT NOT NULL,
    "isRtl" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supported_languages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "active_ingredients" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "dosageForm" "DosageForm" NOT NULL,
    "manufacturer" TEXT,
    "compositionText" TEXT,
    "packSizeText" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "summary" TEXT,
    "commonUses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mechanismSummary" TEXT,
    "commonSideEffects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cautionGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storageInformation" TEXT,
    "prescriptionOnly" BOOLEAN NOT NULL DEFAULT true,
    "status" "MedicineStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_ingredients" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" TEXT,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "medicine_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_sources" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "category" "SourceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "version" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_translations" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "summary" TEXT,
    "commonUses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mechanismSummary" TEXT,
    "commonSideEffects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cautionGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storageInformation" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'MACHINE_UNREVIEWED',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "producedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_barcodes" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "type" "ScanType" NOT NULL DEFAULT 'MEDICINE_PACKAGE',
    "status" "ScanStatus" NOT NULL DEFAULT 'UPLOADED',
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "imageKey" TEXT,
    "imageMimeType" TEXT,
    "imageBytes" INTEGER,
    "imageExpiresAt" TIMESTAMP(3),
    "rawOcrText" TEXT,
    "ocrProvider" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "ocrDurationMs" INTEGER,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "medicineId" TEXT,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "matchedOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractedBrand" TEXT,
    "extractedGeneric" TEXT,
    "extractedStrength" TEXT,
    "extractedForm" TEXT,
    "extractedManufacturer" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "status" "ScanStatus" NOT NULL DEFAULT 'UPLOADED',
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "imageKey" TEXT,
    "imageExpiresAt" TIMESTAMP(3),
    "rawOcrText" TEXT,
    "ocrProvider" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "isLegible" BOOLEAN NOT NULL DEFAULT true,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_lines" (
    "id" TEXT NOT NULL,
    "prescriptionScanId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "detectedName" TEXT,
    "detectedStrength" TEXT,
    "detectedFrequency" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "needsVerification" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "prescription_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "imageKey" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SCAN',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_error_logs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_preferences_languageCode_idx" ON "user_preferences"("languageCode");

-- CreateIndex
CREATE INDEX "supported_languages_isEnabled_sortOrder_idx" ON "supported_languages"("isEnabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "active_ingredients_slug_key" ON "active_ingredients"("slug");

-- CreateIndex
CREATE INDEX "active_ingredients_name_idx" ON "active_ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_slug_key" ON "medicines"("slug");

-- CreateIndex
CREATE INDEX "medicines_status_verificationStatus_idx" ON "medicines"("status", "verificationStatus");

-- CreateIndex
CREATE INDEX "medicines_genericName_idx" ON "medicines"("genericName");

-- CreateIndex
CREATE INDEX "medicines_manufacturer_idx" ON "medicines"("manufacturer");

-- CreateIndex
CREATE INDEX "medicines_searchText_idx" ON "medicines"("searchText");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_brandName_strength_dosageForm_manufacturer_key" ON "medicines"("brandName", "strength", "dosageForm", "manufacturer");

-- CreateIndex
CREATE INDEX "medicine_ingredients_ingredientId_idx" ON "medicine_ingredients"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_ingredients_medicineId_ingredientId_key" ON "medicine_ingredients"("medicineId", "ingredientId");

-- CreateIndex
CREATE INDEX "medicine_sources_medicineId_idx" ON "medicine_sources"("medicineId");

-- CreateIndex
CREATE INDEX "medicine_sources_category_idx" ON "medicine_sources"("category");

-- CreateIndex
CREATE INDEX "medicine_translations_languageCode_status_idx" ON "medicine_translations"("languageCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_translations_medicineId_languageCode_key" ON "medicine_translations"("medicineId", "languageCode");

-- CreateIndex
CREATE INDEX "medicine_barcodes_code_idx" ON "medicine_barcodes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_barcodes_code_medicineId_key" ON "medicine_barcodes"("code", "medicineId");

-- CreateIndex
CREATE INDEX "medicine_scans_userId_createdAt_idx" ON "medicine_scans"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "medicine_scans_guestKey_idx" ON "medicine_scans"("guestKey");

-- CreateIndex
CREATE INDEX "medicine_scans_status_createdAt_idx" ON "medicine_scans"("status", "createdAt");

-- CreateIndex
CREATE INDEX "medicine_scans_imageExpiresAt_idx" ON "medicine_scans"("imageExpiresAt");

-- CreateIndex
CREATE INDEX "scan_results_scanId_rank_idx" ON "scan_results"("scanId", "rank");

-- CreateIndex
CREATE INDEX "scan_results_medicineId_idx" ON "scan_results"("medicineId");

-- CreateIndex
CREATE INDEX "scan_results_confidenceLevel_idx" ON "scan_results"("confidenceLevel");

-- CreateIndex
CREATE INDEX "prescription_scans_userId_createdAt_idx" ON "prescription_scans"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "prescription_scans_guestKey_idx" ON "prescription_scans"("guestKey");

-- CreateIndex
CREATE INDEX "prescription_scans_imageExpiresAt_idx" ON "prescription_scans"("imageExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_lines_prescriptionScanId_lineNumber_key" ON "prescription_lines"("prescriptionScanId", "lineNumber");

-- CreateIndex
CREATE INDEX "user_history_userId_viewedAt_idx" ON "user_history"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "user_history_medicineId_idx" ON "user_history"("medicineId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "system_error_logs_area_createdAt_idx" ON "system_error_logs"("area", "createdAt");

-- CreateIndex
CREATE INDEX "system_error_logs_code_idx" ON "system_error_logs"("code");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_languageCode_fkey" FOREIGN KEY ("languageCode") REFERENCES "supported_languages"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_ingredients" ADD CONSTRAINT "medicine_ingredients_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_ingredients" ADD CONSTRAINT "medicine_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "active_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_sources" ADD CONSTRAINT "medicine_sources_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_translations" ADD CONSTRAINT "medicine_translations_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_translations" ADD CONSTRAINT "medicine_translations_languageCode_fkey" FOREIGN KEY ("languageCode") REFERENCES "supported_languages"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_translations" ADD CONSTRAINT "medicine_translations_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_barcodes" ADD CONSTRAINT "medicine_barcodes_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_scans" ADD CONSTRAINT "medicine_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "medicine_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_scans" ADD CONSTRAINT "prescription_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_lines" ADD CONSTRAINT "prescription_lines_prescriptionScanId_fkey" FOREIGN KEY ("prescriptionScanId") REFERENCES "prescription_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
