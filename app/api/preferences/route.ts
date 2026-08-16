import { assertSameOrigin, fail, guardRate, ok, parseJson } from '@/lib/api';
import { getDb } from '@/lib/db';
import { preferencesSchema } from '@/lib/schemas';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Read the signed-in user's preferences. Guests get the defaults. */
export async function GET(req: Request) {
  try {
    guardRate(req, 'preferences:get', { limit: 60 });
    const user = await getSessionUser();
    const db = getDb();

    if (!user || !db) {
      return ok({
        signedIn: false,
        preferences: {
          languageCode: 'en',
          ttsEnabled: true,
          ttsRate: 1,
          saveScanImages: false,
          highContrast: false,
          largeText: false,
          onboardingDone: false,
        },
      });
    }

    const prefs = await db.userPreference.findUnique({ where: { userId: user.id } });
    return ok({
      signedIn: true,
      preferences: {
        languageCode: prefs?.languageCode ?? 'en',
        ttsEnabled: prefs?.ttsEnabled ?? true,
        ttsRate: prefs?.ttsRate ?? 1,
        saveScanImages: prefs?.saveScanImages ?? false,
        highContrast: prefs?.highContrast ?? false,
        largeText: prefs?.largeText ?? false,
        onboardingDone: prefs?.onboardingDone ?? false,
      },
    });
  } catch (e) {
    return fail(e, 'preferences');
  }
}

/**
 * Update preferences.
 *
 * A guest gets a 200 with `persisted: false` rather than a 401: the language
 * picker calls this on every change and a guest's choice already lives in a
 * cookie, so failing here would be noise, not a security boundary.
 */
export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    guardRate(req, 'preferences:update', { limit: 60 });

    const body = await parseJson(req, preferencesSchema);
    const user = await getSessionUser();
    const db = getDb();
    if (!user || !db) return ok({ persisted: false });

    const prefs = await db.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...body },
      update: body,
    });

    return ok({
      persisted: true,
      preferences: {
        languageCode: prefs.languageCode,
        ttsEnabled: prefs.ttsEnabled,
        ttsRate: prefs.ttsRate,
        saveScanImages: prefs.saveScanImages,
        highContrast: prefs.highContrast,
        largeText: prefs.largeText,
        onboardingDone: prefs.onboardingDone,
      },
    });
  } catch (e) {
    return fail(e, 'preferences');
  }
}
