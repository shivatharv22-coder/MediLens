import { describe, expect, it } from 'vitest';
import { classifyDbFailure, isDatabaseUnavailable } from '@/lib/db';

/**
 * "Postgres is down" must stay distinguishable from "that query was wrong".
 *
 * The two produce different user-facing messages — "temporarily unavailable,
 * try again shortly" versus "something went wrong" — and getting it backwards
 * either tells a user to retry a request that will never succeed, or hides a
 * real outage behind a generic error.
 */

/** Approximates a `PrismaClientKnownRequestError` closely enough to classify. */
function prismaError(code: string, message: string) {
  const e = new Error(message) as Error & { code: string };
  e.name = 'PrismaClientKnownRequestError';
  e.code = code;
  return e;
}

describe('isDatabaseUnavailable', () => {
  it('recognises a Prisma connectivity code', () => {
    expect(isDatabaseUnavailable(prismaError('P1001', "Can't reach database server"))).toBe(true);
  });

  it('recognises a refused socket from the pg driver', () => {
    expect(isDatabaseUnavailable(prismaError('ECONNREFUSED', 'connect ECONNREFUSED'))).toBe(true);
  });

  it('recognises an unreachable server behind a raw-query failure', () => {
    // $queryRaw reports everything as P2010, so the code alone says nothing.
    expect(
      isDatabaseUnavailable(
        prismaError(
          'P2010',
          'Invalid `prisma.$queryRaw()` invocation:\nRaw query failed. Code: `N/A`. ' +
            "Message: `Can't reach database server at db.example:5432`",
        ),
      ),
    ).toBe(true);
  });

  it('does not treat a broken raw query as an outage', () => {
    expect(
      isDatabaseUnavailable(
        prismaError(
          'P2010',
          'Raw query failed. Code: `42703`. Message: `column "nope" does not exist`',
        ),
      ),
    ).toBe(false);
  });

  it('does not treat an ordinary query error as an outage', () => {
    expect(isDatabaseUnavailable(prismaError('P2002', 'Unique constraint failed'))).toBe(false);
  });

  it('unwraps a nested cause', () => {
    const outer = new Error('wrapped', { cause: prismaError('P1001', 'unreachable') });
    expect(isDatabaseUnavailable(outer)).toBe(true);
  });

  it('ignores non-errors', () => {
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable('P1001')).toBe(false);
  });
});

describe('classifyDbFailure', () => {
  it('names an authentication failure from the SQLSTATE', () => {
    expect(classifyDbFailure(prismaError('28P01', 'nope'))).toBe('AUTH_FAILED');
  });

  it('names an authentication failure from the message', () => {
    expect(
      classifyDbFailure(prismaError('P1000', 'password authentication failed for user "x"')),
    ).toBe('AUTH_FAILED');
  });

  it('distinguishes DNS from a refused socket', () => {
    expect(classifyDbFailure(prismaError('P1001', 'getaddrinfo ENOTFOUND db.example'))).toBe(
      'HOST_NOT_FOUND',
    );
    expect(classifyDbFailure(prismaError('P1001', 'connect ECONNREFUSED 1.2.3.4:5432'))).toBe(
      'CONNECTION_REFUSED',
    );
  });

  it("categorises Prisma's generic unreachable wording", () => {
    expect(classifyDbFailure(prismaError('P1001', "Can't reach database server at h:5432"))).toBe(
      'NETWORK_UNREACHABLE',
    );
  });

  it('falls back to UNKNOWN rather than guessing', () => {
    expect(classifyDbFailure(prismaError('P2010', 'something else entirely'))).toBe('UNKNOWN');
  });
});
