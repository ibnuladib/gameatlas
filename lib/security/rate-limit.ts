/**
 * In-memory sliding-window rate limiter.
 *
 * Best-effort on Vercel serverless: each instance keeps its own counter, so a
 * determined client could spread requests across instances. Still stops casual
 * abuse and protects upstream APIs (Steam, Groq, Supabase) from hammering.
 */

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth if clients rotate IPs/keys.
const MAX_BUCKETS = 10_000;

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > config.max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}

/** Prefer the first IP in X-Forwarded-For; fall back to a constant for local dev. */
export function clientRateLimitKey(forwardedFor: string | null, fallback = 'local'): string {
  if (!forwardedFor) return fallback;
  const ip = forwardedFor.split(',')[0]?.trim();
  return ip || fallback;
}

export const RATE_LIMITS = {
  /** General read APIs — generous for map pan/zoom. */
  read: { windowMs: 60_000, max: 120 },
  /** POST endpoints that call Steam or Groq — tighter. */
  write: { windowMs: 60_000, max: 20 },
  /** Natural-language /ask — tightest; may call Groq. */
  ask: { windowMs: 60_000, max: 15 },
} as const satisfies Record<string, RateLimitConfig>;
