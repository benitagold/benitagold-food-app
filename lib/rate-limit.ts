/**
 * Minimal in-memory guard against duplicate/rapid-fire submissions
 * (e.g. a user double-clicking "ثبت نهایی" or refreshing right after submit).
 *
 * NOTE: this state lives in server memory, so it resets on redeploy and is
 * NOT shared across multiple server instances. That's an acceptable
 * trade-off for a small internal tool with two locations. If you scale this
 * to multiple server instances / serverless with concurrency, replace this
 * with a shared store (e.g. Redis, or a row in your database) keyed the
 * same way.
 */

interface Entry {
  lastSubmittedAt: number;
  idempotencyKeys: Set<string>;
}

const COOLDOWN_MS = 20_000; // minimum gap between two submissions from the same client
const store = new Map<string, Entry>();

// Periodically forget old entries so this Map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [key, entry] of store) {
    if (entry.lastSubmittedAt < cutoff) store.delete(key);
  }
}, 5 * 60_000).unref?.();

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

/**
 * @param clientKey  something that identifies the client — we use the IP.
 * @param idempotencyKey  a random id generated per form-submission by the client,
 *                        so an accidental double network-retry of the exact same
 *                        submission is rejected even within the cooldown window.
 */
export function checkAndRegisterSubmission(
  clientKey: string,
  idempotencyKey: string
): GuardResult {
  const now = Date.now();
  const entry = store.get(clientKey);

  if (entry) {
    if (entry.idempotencyKeys.has(idempotencyKey)) {
      return { allowed: false, reason: "این سفارش قبلاً ثبت شده است." };
    }
    if (now - entry.lastSubmittedAt < COOLDOWN_MS) {
      return {
        allowed: false,
        reason: "لطفاً چند ثانیه صبر کنید و دوباره تلاش کنید.",
      };
    }
  }

  const nextEntry: Entry = entry ?? { lastSubmittedAt: 0, idempotencyKeys: new Set() };
  nextEntry.lastSubmittedAt = now;
  nextEntry.idempotencyKeys.add(idempotencyKey);
  store.set(clientKey, nextEntry);

  return { allowed: true };
}
