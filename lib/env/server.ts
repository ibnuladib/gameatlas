/**
 * Server-only environment access. Import this module only from Route Handlers,
 * Server Components, or other server code — never from Client Components.
 *
 * Secrets listed here must never appear in next.config.js `env` or any
 * NEXT_PUBLIC_* variable.
 */

const SECRET_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STEAM_API_KEY',
  'GROQ_API_KEY',
  'CRON_SECRET',
  'SUPABASE_ACCESS_TOKEN',
  'DATABASE_URL',
] as const;

/** Returns a secret or undefined. Never log the return value. */
export function getSecret(name: (typeof SECRET_KEYS)[number]): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getPublicSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function getPublicSupabaseKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || undefined;
}

/** True when every public Supabase var needed for reads is present. */
export function hasPublicSupabaseConfig(): boolean {
  return Boolean(getPublicSupabaseUrl() && getPublicSupabaseKey());
}

/** Warn at startup if a secret looks accidentally prefixed with NEXT_PUBLIC_. */
export function assertNoLeakedSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  for (const key of SECRET_KEYS) {
    const leaked = process.env[`NEXT_PUBLIC_${key}`];
    if (leaked) {
      console.error(`[security] ${key} must not use the NEXT_PUBLIC_ prefix`);
    }
  }
}
