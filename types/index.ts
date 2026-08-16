export * from './medicine';
export * from './identification';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  /** Stable machine code the client maps to a translated message. */
  error: string;
  /** Safe, already-generic English fallback. Never a raw exception. */
  message: string;
  /** Field-level validation problems, when applicable. */
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
