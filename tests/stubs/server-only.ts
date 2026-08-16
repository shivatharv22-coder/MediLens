/**
 * Stub for the `server-only` guard.
 *
 * The real package throws when a bundler resolves it into a client graph.
 * Vitest has no server/client graph, so it is aliased to this no-op — the guard
 * still does its job in the Next.js build, which is where it matters.
 */
export {};
