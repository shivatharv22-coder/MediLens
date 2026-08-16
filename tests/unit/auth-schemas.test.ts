import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/schemas';
import { PASSWORD_RULES } from '@/config/app';

/**
 * The password policy is stated twice — once for the server (`signUpSchema`)
 * and once for the user (`PASSWORD_RULES`). These tests exist to stop the two
 * drifting apart, which is how a form ends up accepting input the API rejects.
 */
describe('password policy', () => {
  const valid = 'CorrectHorse1Battery';

  it('accepts a password that satisfies every displayed rule', () => {
    expect(PASSWORD_RULES.every((r) => r.test(valid))).toBe(true);
    expect(signUpSchema.safeParse({ email: 'a@b.com', password: valid }).success).toBe(true);
  });

  const rejected: { label: string; password: string }[] = [
    { label: 'too short', password: 'Short1aa' },
    { label: 'no digit', password: 'NoDigitsHereAtAll' },
    { label: 'no upper case', password: 'alllowercase123' },
    { label: 'no lower case', password: 'ALLUPPERCASE123' },
  ];

  for (const { label, password } of rejected) {
    it(`rejects a password that is ${label}`, () => {
      expect(signUpSchema.safeParse({ email: 'a@b.com', password }).success).toBe(false);
      // The visible checklist must agree with the server.
      expect(PASSWORD_RULES.every((r) => r.test(password))).toBe(false);
    });
  }

  it('rejects an absurdly long password rather than hashing it', () => {
    const result = signUpSchema.safeParse({ email: 'a@b.com', password: 'A1'.repeat(200) });
    expect(result.success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('normalises the email address', () => {
    const parsed = signUpSchema.parse({ email: '  MixedCase@Example.COM ', password: 'CorrectHorse1Battery' });
    expect(parsed.email).toBe('mixedcase@example.com');
  });

  it('rejects a malformed email', () => {
    expect(signUpSchema.safeParse({ email: 'not-an-email', password: 'CorrectHorse1Battery' }).success).toBe(false);
  });

  it('treats the display name as optional', () => {
    expect(signUpSchema.safeParse({ email: 'a@b.com', password: 'CorrectHorse1Battery' }).success).toBe(true);
  });
});

describe('signInSchema', () => {
  it('normalises the email the same way sign-up does', () => {
    // If these differed, an account created as "A@b.com" could not sign in.
    const signUp = signUpSchema.parse({ email: ' A@B.com ', password: 'CorrectHorse1Battery' });
    const signIn = signInSchema.parse({ email: ' A@B.com ', password: 'whatever' });
    expect(signIn.email).toBe(signUp.email);
  });

  it('does not apply the password policy to sign-in', () => {
    // An old account may predate the current rules; it must still be able to
    // attempt a login rather than be blocked by client-side validation.
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('forgotPasswordSchema', () => {
  it('normalises the email address', () => {
    expect(forgotPasswordSchema.parse({ email: ' USER@Example.com ' }).email).toBe('user@example.com');
  });

  it('rejects a malformed address', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const token = 'a'.repeat(43);

  it('accepts a matching pair that satisfies the policy', () => {
    const result = resetPasswordSchema.safeParse({
      token,
      password: 'CorrectHorse1Battery',
      confirmPassword: 'CorrectHorse1Battery',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a mismatched confirmation and points at the right field', () => {
    const result = resetPasswordSchema.safeParse({
      token,
      password: 'CorrectHorse1Battery',
      confirmPassword: 'CorrectHorse1Batteryy',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('applies the same password policy as sign-up', () => {
    const result = resetPasswordSchema.safeParse({
      token,
      password: 'weak',
      confirmPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a token that is too short to be real', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'abc',
      password: 'CorrectHorse1Battery',
      confirmPassword: 'CorrectHorse1Battery',
    });
    expect(result.success).toBe(false);
  });
});
