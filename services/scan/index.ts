import 'server-only';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';
import { getDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recordSystemError } from '@/lib/system-log';
import { validateImageUpload } from '@/lib/upload';
import { getOcrProvider } from '@/services/ocr';
import { getStorageProvider } from '@/services/storage';
import { getMedicineRepository } from '@/services/medicine';
import { identifyFromOcrText } from '@/services/identification';
import { extractPrescription, type PrescriptionExtraction } from '@/services/prescription/extract';
import type { IdentificationResult } from '@/types/identification';

/**
 * Scan orchestration: upload -> validate -> (optionally store) -> OCR ->
 * extract -> match.
 *
 * Privacy behaviour (§10, §23): the uploaded image is only written to storage
 * when the caller explicitly asks for it. Otherwise it lives in memory for the
 * duration of the request and is never persisted. The raw OCR text is stored
 * separately from the interpreted fields and is never rewritten.
 */

export interface ScanContext {
  userId: string | null;
  guestKey: string | null;
  languageCode: string;
  /** Only true when the user opted in to keeping their images. */
  keepImage: boolean;
}

export interface ScanOutcome {
  scanId: string;
  identification: IdentificationResult;
  rawOcrText: string;
  ocrConfidence: number;
  ocrProvider: string;
  /** True when the result was persisted and can be re-fetched by id. */
  persisted: boolean;
}

export async function processMedicineScan(
  file: File,
  context: ScanContext,
): Promise<ScanOutcome> {
  const upload = await validateImageUpload(file);
  const db = getDb();
  const storage = getStorageProvider();

  let imageKey: string | null = null;
  let imageExpiresAt: Date | null = null;
  if (context.keepImage) {
    const stored = await storage.put({
      data: upload.data,
      mimeType: upload.mimeType,
      prefix: 'scan',
      retentionHours: env.UPLOAD_RETENTION_HOURS,
    });
    imageKey = stored.key;
    imageExpiresAt = stored.expiresAt;
  }

  // Create the scan row first so an OCR failure is still visible to admins.
  let scanId: string = randomUUID();
  if (db) {
    const row = await db.medicineScan.create({
      data: {
        userId: context.userId,
        guestKey: context.userId ? null : context.guestKey,
        type: 'MEDICINE_PACKAGE',
        status: 'OCR_RUNNING',
        languageCode: context.languageCode,
        imageKey,
        imageMimeType: imageKey ? upload.mimeType : null,
        imageBytes: imageKey ? upload.size : null,
        imageExpiresAt,
      },
      select: { id: true },
    });
    scanId = row.id;
  }

  const ocr = getOcrProvider();
  let ocrText = '';
  let ocrConfidence = 0;

  try {
    const result = await ocr.recognise({
      image: upload.data,
      mimeType: upload.mimeType,
      languages: env.OCR_LANGUAGES.split(',').map((l) => l.trim()).filter(Boolean),
    });
    ocrText = result.text;
    ocrConfidence = result.confidence;

    if (db) {
      await db.medicineScan.update({
        where: { id: scanId },
        data: {
          status: 'MATCHING',
          rawOcrText: result.text,
          ocrProvider: result.provider,
          ocrConfidence: result.confidence,
          ocrDurationMs: result.durationMs,
        },
      });
    }
  } catch (e) {
    if (db) {
      await db.medicineScan
        .update({ where: { id: scanId }, data: { status: 'OCR_FAILED', failureCode: 'OCR_ERROR' } })
        .catch(() => undefined);
    }
    await recordSystemError({
      code: 'OCR_PROVIDER_FAILURE',
      area: 'ocr',
      message: e instanceof Error ? e.message : 'OCR failed',
      context: { provider: ocr.name },
    });
    throw e;
  }

  const repository = getMedicineRepository();
  const identification = await identifyFromOcrText(ocrText, repository);

  if (db) {
    await db.$transaction([
      db.medicineScan.update({
        where: { id: scanId },
        data: {
          status: 'COMPLETED',
          failureCode:
            identification.messageCode === 'IDENTIFIED' ? null : identification.messageCode,
        },
      }),
      db.scanResult.createMany({
        data: identification.candidates.length
          ? identification.candidates.map((candidate, index) => ({
              scanId,
              medicineId: candidate.medicine.id,
              confidenceLevel:
                index === 0 ? identification.confidenceLevel : ('LOW' as const),
              confidenceScore: candidate.score,
              matchedOn: candidate.signals,
              extractedBrand: identification.extracted.brandName,
              extractedGeneric: identification.extracted.genericName,
              extractedStrength: identification.extracted.strength,
              extractedForm: identification.extracted.dosageForm,
              extractedManufacturer: identification.extracted.manufacturer,
              rank: index,
            }))
          : [
              {
                scanId,
                medicineId: null,
                confidenceLevel: 'NOT_IDENTIFIED' as const,
                confidenceScore: 0,
                matchedOn: [],
                extractedBrand: identification.extracted.brandName,
                extractedGeneric: identification.extracted.genericName,
                extractedStrength: identification.extracted.strength,
                extractedForm: identification.extracted.dosageForm,
                extractedManufacturer: identification.extracted.manufacturer,
                rank: 0,
              },
            ],
      }),
    ]);
  }

  // Nothing kept the image, so drop it now rather than at retention time.
  if (!context.keepImage && imageKey) await storage.delete(imageKey);

  logger.info('Medicine scan processed', {
    scanId,
    confidence: identification.confidenceLevel,
    messageCode: identification.messageCode,
    candidateCount: identification.candidates.length,
    persisted: !!db,
  });

  return {
    scanId,
    identification,
    rawOcrText: ocrText,
    ocrConfidence,
    ocrProvider: ocr.name,
    persisted: !!db,
  };
}

export interface PrescriptionOutcome {
  scanId: string;
  extraction: PrescriptionExtraction;
  persisted: boolean;
}

export async function processPrescriptionScan(
  file: File,
  context: ScanContext,
): Promise<PrescriptionOutcome> {
  const upload = await validateImageUpload(file);
  const db = getDb();
  const storage = getStorageProvider();

  let imageKey: string | null = null;
  let imageExpiresAt: Date | null = null;
  if (context.keepImage) {
    const stored = await storage.put({
      data: upload.data,
      mimeType: upload.mimeType,
      prefix: 'prescription',
      retentionHours: env.UPLOAD_RETENTION_HOURS,
    });
    imageKey = stored.key;
    imageExpiresAt = stored.expiresAt;
  }

  let scanId: string = randomUUID();
  if (db) {
    const row = await db.prescriptionScan.create({
      data: {
        userId: context.userId,
        guestKey: context.userId ? null : context.guestKey,
        status: 'OCR_RUNNING',
        languageCode: context.languageCode,
        imageKey,
        imageExpiresAt,
      },
      select: { id: true },
    });
    scanId = row.id;
  }

  const ocr = getOcrProvider();
  let extraction: PrescriptionExtraction;

  try {
    const result = await ocr.recognise({
      image: upload.data,
      mimeType: upload.mimeType,
      languages: env.OCR_LANGUAGES.split(',').map((l) => l.trim()).filter(Boolean),
    });
    extraction = extractPrescription(result);

    if (db) {
      await db.$transaction([
        db.prescriptionScan.update({
          where: { id: scanId },
          data: {
            status: 'COMPLETED',
            rawOcrText: result.text,
            ocrProvider: result.provider,
            ocrConfidence: result.confidence,
            isLegible: extraction.isLegible,
            failureCode: extraction.isLegible ? null : 'ILLEGIBLE',
          },
        }),
        db.prescriptionLine.createMany({
          data: extraction.lines.map((line) => ({
            prescriptionScanId: scanId,
            lineNumber: line.lineNumber,
            rawText: line.rawText,
            detectedName: line.detectedName,
            detectedStrength: line.detectedStrength,
            detectedFrequency: line.detectedFrequency,
            confidence: line.confidence,
            needsVerification: line.needsVerification,
          })),
        }),
      ]);
    }
  } catch (e) {
    if (db) {
      await db.prescriptionScan
        .update({ where: { id: scanId }, data: { status: 'OCR_FAILED', failureCode: 'OCR_ERROR' } })
        .catch(() => undefined);
    }
    await recordSystemError({
      code: 'OCR_PROVIDER_FAILURE',
      area: 'ocr',
      message: e instanceof Error ? e.message : 'OCR failed',
      context: { provider: ocr.name, kind: 'prescription' },
    });
    throw e;
  }

  if (!context.keepImage && imageKey) await storage.delete(imageKey);

  logger.info('Prescription scan processed', {
    scanId,
    legible: extraction.isLegible,
    lineCount: extraction.lines.length,
  });

  return { scanId, extraction, persisted: !!db };
}
