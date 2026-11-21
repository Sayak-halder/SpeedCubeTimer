/**
 * A fixed-window counter held in memory.
 *
 * Read the limitation before relying on this: serverless functions run as
 * several independent instances, and each keeps its own copy of this map, so
 * the real ceiling is roughly `limit x instances` and the count resets
 * whenever an instance is recycled. That makes it a speed bump against
 * password guessing, not a wall.
 *
 * For a real limit, move the counter somewhere shared — Vercel KV, Upstash
 * Redis, or a table in the Postgres database already configured here. The
 * `check` signature below is what a shared implementation would need to
 * match, so swapping it is a one-file change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function check(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup, so an abandoned key cannot grow the map forever.
  if (windows.size > MAX_KEYS) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client address. On Vercel `x-forwarded-for` is set by the proxy
 * and its first entry is the client; elsewhere it can be spoofed, which is
 * another reason not to treat this as a hard limit.
 */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}
