/** Join class names, dropping falsy values. Deliberately tiny — no dependency. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
