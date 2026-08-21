import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '@/config/env';
import { ResendMailer } from '@/services/mailer/resend-mailer';
import { AppError } from '@/lib/errors';

/**
 * Resend delivery, exercised without touching the network or a real key.
 *
 * `env` is a plain object, so each test sets the credentials it needs and the
 * teardown restores them. `fetch` is stubbed and its call is inspected -- this
 * is the only place that asserts the outgoing request shape, so a change to the
 * from address, auth header or endpoint is caught here.
 */

const REAL = { key: env.RESEND_API_KEY, from: env.MAIL_FROM };

function stubFetch(response: Partial<Response> & { ok: boolean; status: number }) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

type FetchMock = ReturnType<typeof stubFetch>;

/** The JSON body sent to Resend for the most recent call. */
function sentBody(fetchMock: FetchMock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

const message = {
  to: 'user@example.com',
  subject: 'Reset your MediLens password',
  text: 'Open http://localhost:3000/auth/reset-password?token=SECRET_TOKEN',
  kind: 'password-reset',
};

beforeEach(() => {
  env.RESEND_API_KEY = 'test_re_key';
  env.MAIL_FROM = '';
});

afterEach(() => {
  env.RESEND_API_KEY = REAL.key;
  env.MAIL_FROM = REAL.from;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ResendMailer configuration', () => {
  it('is configured on an API key alone', () => {
    expect(new ResendMailer().isConfigured()).toBe(true);
  });

  it('is configured even without MAIL_FROM', () => {
    env.MAIL_FROM = '';
    expect(new ResendMailer().isConfigured()).toBe(true);
  });

  it('is not configured without an API key', () => {
    env.RESEND_API_KEY = '  ';
    expect(new ResendMailer().isConfigured()).toBe(false);
  });

  it('refuses to send without an API key, and does not call the API', async () => {
    env.RESEND_API_KEY = '';
    const fetchMock = stubFetch({ ok: true, status: 200 });

    await expect(new ResendMailer().send(message)).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ResendMailer delivery', () => {
  it('sends from the sandbox address when MAIL_FROM is unset', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });

    const result = await new ResendMailer().send(message);

    expect(result.channel).toBe('email');
    expect(result.devLocation).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test_re_key');

    const body = sentBody(fetchMock);
    expect(body.from).toBe('onboarding@resend.dev');
    expect(body.to).toEqual(['user@example.com']);
    expect(body.subject).toBe(message.subject);
    expect(body.text).toContain('reset-password?token=SECRET_TOKEN');
  });

  it('prefers a configured MAIL_FROM over the sandbox address', async () => {
    env.MAIL_FROM = 'MediLens <no-reply@medilens.app>';
    const fetchMock = stubFetch({ ok: true, status: 200 });

    await new ResendMailer().send(message);

    expect(sentBody(fetchMock).from).toBe('MediLens <no-reply@medilens.app>');
  });

  it('reports failure as EMAIL_FAILED without leaking the message body', async () => {
    stubFetch({ ok: false, status: 500 });

    const error = await new ResendMailer().send(message).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('EMAIL_FAILED');
    // The safe message must never carry the reset link or token.
    expect(JSON.stringify(error.message)).not.toContain('SECRET_TOKEN');
  });
});
