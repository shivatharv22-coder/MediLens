/**
 * Application constants shared by client and server.
 * Nothing secret belongs in this file.
 */

export const APP_NAME = 'MediLens';
export const APP_TAGLINE = 'Scan. Understand. Learn.';

export const APP_PURPOSE_STATEMENT =
  'An educational medicine-information tool that helps users identify medicines from their packaging and understand verified information about them in their preferred language.';

/** Accepted upload types. Enforced again server-side by magic-byte sniffing. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const MAX_UPLOAD_BYTES_DEFAULT = 8 * 1024 * 1024;

/** Longest edge, in pixels, that the client downscales an image to before upload. */
export const CLIENT_IMAGE_MAX_EDGE = 1600;
export const CLIENT_IMAGE_JPEG_QUALITY = 0.82;

/**
 * Longest edge kept for on-device OCR.
 *
 * Higher than the upload ceiling on purpose. 1600 px is a *network* budget,
 * chosen when the image had to be sent to the server to be read. OCR now runs
 * on the device, so that budget no longer applies to it -- and the small print
 * that matters most, the composition line, is the first thing to fall below a
 * readable x-height when the image is shrunk.
 */
export const CLIENT_OCR_MAX_EDGE = 2400;

/**
 * Confidence thresholds for medicine identification.
 * Only HIGH may be presented as a confirmed identification.
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.6,
  low: 0.3,
} as const;

/**
 * A top candidate only counts as confirmed when it also clearly beats the
 * runner-up. Two similar-looking medicines must never be silently resolved.
 */
export const MIN_LEAD_OVER_RUNNER_UP = 0.12;

/**
 * Password rules, shown to the user next to the field.
 *
 * These strings must stay in step with `passwordSchema` in `lib/schemas.ts`,
 * which is what actually enforces them server-side.
 */
export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_RULES: { id: string; label: string; test: (v: string) => boolean }[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', label: 'A lower-case letter', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'An upper-case letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'A number', test: (v) => /\d/.test(v) },
];

export const SEARCH_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE = 25;
export const ADMIN_PAGE_SIZE = 25;

export const ROUTES = {
  home: '/',
  scan: '/scan',
  scanResult: (scanId: string) => `/scan/${scanId}`,
  search: '/search',
  medicine: (idOrSlug: string) => `/medicine/${idOrSlug}`,
  prescription: '/prescription',
  prescriptionResult: (id: string) => `/prescription/${id}`,
  history: '/history',
  profile: '/profile',
  settings: '/settings',
  language: '/language',
  help: '/help',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  disclaimer: '/legal/disclaimer',
  // Signing in happens on the Profile screen itself; /auth/sign-in redirects
  // there so links and bookmarks keep working.
  signIn: '/profile',
  signUp: '/auth/sign-up',
  forgotPassword: '/auth/forgot-password',
  admin: '/admin',
  adminLogin: '/admin/login',
  adminMedicines: '/admin/medicines',
  adminSources: '/admin/sources',
  adminReview: '/admin/review',
  adminAudit: '/admin/audit',
} as const;
