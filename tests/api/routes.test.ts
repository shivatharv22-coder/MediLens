import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRateLimits } from '@/lib/rate-limit';

/**
 * API-level tests.
 *
 * `next/headers` is mocked with an empty cookie store so route handlers can run
 * outside a request scope. That makes every request in this file an
 * unauthenticated guest — which is exactly the caller the authorisation tests
 * need.
 */
vi.mock('next/headers', () => {
  const store = new Map<string, string>();
  const jar = {
    get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
    set: (name: string, value: string) => store.set(name, value),
    delete: (name: string) => store.delete(name),
  };
  return {
    cookies: async () => jar,
    headers: async () => new Headers(),
  };
});

const ORIGIN = 'http://localhost:3000';

function get(path: string): Request {
  return new Request(`${ORIGIN}${path}`);
}

function post(path: string, body: unknown, origin: string | null = ORIGIN): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => __resetRateLimits());

describe('GET /api/health', () => {
  it('reports configuration without leaking secrets', async () => {
    const { GET } = await import('@/app/api/health/route');
    const body = await (await GET()).json();

    expect(body.ok).toBe(true);
    expect(body.demoMode).toBe(true);
    expect(body.medicineSource.isDemo).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/SESSION_SECRET|API_KEY|password/i);
  });
});

describe('GET /api/medicines', () => {
  it('returns matching medicines', async () => {
    const { GET } = await import('@/app/api/medicines/route');
    const body = await (await GET(get('/api/medicines?q=paracetamol'))).json();

    expect(body.ok).toBe(true);
    expect(body.data.total).toBeGreaterThan(0);
    expect(body.data.isDemo).toBe(true);
  });

  it('rejects an invalid dosage form instead of ignoring it', async () => {
    const { GET } = await import('@/app/api/medicines/route');
    const response = await GET(get('/api/medicines?q=x&dosageForm=NOT_A_FORM'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_FAILED');
  });

  it('clamps an absurd page size', async () => {
    const { GET } = await import('@/app/api/medicines/route');
    const response = await GET(get('/api/medicines?q=paracetamol&pageSize=100000'));
    expect(response.status).toBe(400);
  });

  it('enforces a rate limit', async () => {
    const { GET } = await import('@/app/api/medicines/route');
    let limited = false;
    for (let i = 0; i < 70; i += 1) {
      const response = await GET(get('/api/medicines?q=a'));
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});

describe('GET /api/medicines/[id]', () => {
  it('returns a localised medicine', async () => {
    const { GET } = await import('@/app/api/medicines/[id]/route');
    const response = await GET(get('/api/medicines/crocin-500-mg-tablet?language=hi'), {
      params: Promise.resolve({ id: 'crocin-500-mg-tablet' }),
    });
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.medicine.contentLanguage).toBe('hi');
    expect(body.data.medicine.summary).toContain('पैरासिटामोल');
  });

  it('404s for an unknown medicine', async () => {
    const { GET } = await import('@/app/api/medicines/[id]/route');
    const response = await GET(get('/api/medicines/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    });
    expect(response.status).toBe(404);
  });

  it('never exposes a raw exception message', async () => {
    const { GET } = await import('@/app/api/medicines/[id]/route');
    const response = await GET(get('/api/medicines/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    });
    const body = await response.json();
    expect(body.message).toBe('We could not find what you were looking for.');
    expect(body).not.toHaveProperty('stack');
  });
});

describe('POST /api/ai/ask', () => {
  it('refuses a personalised question through the API', async () => {
    const { POST } = await import('@/app/api/ai/ask/route');
    const response = await POST(
      post('/api/ai/ask', {
        medicineId: 'med-paracetamol-500-tab',
        question: 'How much should I take?',
        language: 'en',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.refused).toBe(true);
    expect(body.data.refusalReason).toBe('DOSAGE_ADVICE');
    expect(body.data.text).toContain('qualified healthcare professional');
  });

  it('answers an educational question', async () => {
    const { POST } = await import('@/app/api/ai/ask/route');
    const body = await (
      await POST(
        post('/api/ai/ask', {
          medicineId: 'med-paracetamol-500-tab',
          question: 'What are the common side effects?',
          language: 'en',
        }),
      )
    ).json();

    expect(body.data.refused).toBe(false);
    expect(body.data.groundedIn).toContain('commonSideEffects');
  });

  it('rejects a cross-origin write', async () => {
    const { POST } = await import('@/app/api/ai/ask/route');
    const response = await POST(
      post(
        '/api/ai/ask',
        { medicineId: 'med-paracetamol-500-tab', question: 'What is this?', language: 'en' },
        'https://evil.example.com',
      ),
    );
    expect(response.status).toBe(403);
  });

  it('rejects a malformed body', async () => {
    const { POST } = await import('@/app/api/ai/ask/route');
    const response = await POST(post('/api/ai/ask', { medicineId: '', question: 'x' }));
    expect(response.status).toBe(400);
  });

  it('404s for a medicine that does not exist', async () => {
    const { POST } = await import('@/app/api/ai/ask/route');
    const response = await POST(
      post('/api/ai/ask', { medicineId: 'does-not-exist', question: 'What is this?' }),
    );
    expect(response.status).toBe(404);
  });
});

describe('authorisation', () => {
  it('refuses the admin medicine list to an anonymous caller', async () => {
    const { GET } = await import('@/app/api/admin/medicines/route');
    const response = await GET(get('/api/admin/medicines'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('refuses admin medicine creation to an anonymous caller', async () => {
    const { POST } = await import('@/app/api/admin/medicines/route');
    const response = await POST(
      post('/api/admin/medicines', {
        brandName: 'Fake',
        genericName: 'Fake',
        strength: '1 mg',
        dosageForm: 'TABLET',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('refuses the audit log to an anonymous caller', async () => {
    const { GET } = await import('@/app/api/admin/audit/route');
    expect((await GET(get('/api/admin/audit'))).status).toBe(401);
  });

  it('refuses history reads to an anonymous caller', async () => {
    const { GET } = await import('@/app/api/history/route');
    expect((await GET(get('/api/history'))).status).toBe(401);
  });

  it('refuses history deletion to an anonymous caller', async () => {
    const { DELETE } = await import('@/app/api/history/[id]/route');
    const request = new Request(`${ORIGIN}/api/history/someone-elses-id`, {
      method: 'DELETE',
      headers: { origin: ORIGIN },
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'someone-elses-id' }) });
    expect(response.status).toBe(401);
  });
});

describe('password reset endpoints', () => {
  // No DATABASE_URL in the test environment, so these assert the guard rails
  // that must hold before any database work happens.
  it('rejects a cross-origin forgot-password request', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const response = await POST(
      post('/api/auth/forgot-password', { email: 'a@b.com' }, 'https://evil.example.com'),
    );
    expect(response.status).toBe(403);
  });

  it('refuses to start a reset when accounts are not enabled', async () => {
    // This suite runs without DATABASE_URL, which is a real deployment shape.
    // The endpoint must decline rather than half-work.
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const response = await POST(post('/api/auth/forgot-password', { email: 'a@b.com' }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe('FEATURE_DISABLED');
  });

  it('never reveals whether an address has an account', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const known = await (await POST(post('/api/auth/forgot-password', { email: 'admin@medilens.local' }))).json();
    const unknown = await (await POST(post('/api/auth/forgot-password', { email: 'nobody@nowhere.test' }))).json();
    // Identical responses either way — no account-existence oracle.
    expect(known).toEqual(unknown);
  });

  it('rejects a cross-origin code verification', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/verify/route');
    const response = await POST(
      post('/api/auth/reset-password/verify', { email: 'a@b.com', code: '042317' }, 'https://evil.example.com'),
    );
    expect(response.status).toBe(403);
  });

  it('declines code verification when accounts are not enabled', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/verify/route');
    const response = await POST(post('/api/auth/reset-password/verify', { email: 'a@b.com', code: '042317' }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toBe('FEATURE_DISABLED');
  });

  it('rejects a cross-origin reset submission', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(
      post(
        '/api/auth/reset-password',
        {
          email: 'a@b.com',
          code: '042317',
          password: 'CorrectHorse1Battery',
          confirmPassword: 'CorrectHorse1Battery',
        },
        'https://evil.example.com',
      ),
    );
    expect(response.status).toBe(403);
  });

  it('declines a reset submission when accounts are not enabled', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(
      post('/api/auth/reset-password', {
        email: 'a@b.com',
        code: '042317',
        password: 'CorrectHorse1Battery',
        confirmPassword: 'DifferentHorse1Battery',
      }),
    );
    expect(response.status).toBe(503);
  });

  it('declines a weak new password without accounts enabled', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(
      post('/api/auth/reset-password', {
        email: 'a@b.com',
        code: '042317',
        password: 'weak',
        confirmPassword: 'weak',
      }),
    );
    // Password strength itself is covered by tests/unit/auth-schemas.test.ts.
    expect(response.status).toBe(503);
  });

  it('never echoes the submitted code back to the caller', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const code = '424242';
    const response = await POST(
      post('/api/auth/reset-password', {
        email: 'a@b.com',
        code,
        password: 'CorrectHorse1Battery',
        confirmPassword: 'CorrectHorse1Battery',
      }),
    );
    expect(JSON.stringify(await response.json())).not.toContain(code);
  });
});

describe('GET /api/preferences', () => {
  it('returns defaults for a guest without failing', async () => {
    const { GET } = await import('@/app/api/preferences/route');
    const body = await (await GET(get('/api/preferences'))).json();

    expect(body.ok).toBe(true);
    expect(body.data.signedIn).toBe(false);
    expect(body.data.preferences.saveScanImages).toBe(false);
  });
});
