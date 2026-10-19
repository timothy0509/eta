// Build-time constant so the client bundle never includes package.json.
// NEXT_PUBLIC_* values are inlined at build, with a literal fallback for
// local dev. version.test.ts keeps the fallback in sync with package.json.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'
