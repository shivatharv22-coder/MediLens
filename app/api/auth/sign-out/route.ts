import { assertSameOrigin, fail, ok } from '@/lib/api';
import { audit } from '@/lib/audit';
import { destroySession, getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    await destroySession();

    if (user) {
      await audit({
        action: 'LOGOUT',
        actorId: user.id,
        actorEmail: user.email,
        entityType: 'User',
        entityId: user.id,
        request: req,
      });
    }

    return ok({ signedOut: true });
  } catch (e) {
    return fail(e, 'auth');
  }
}
