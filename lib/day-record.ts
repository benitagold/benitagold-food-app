import { Redis } from "@upstash/redis";
import { getTehranDateKey } from "@/lib/time-window";

// Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, which Vercel sets
// automatically once a Redis (Upstash) database from the Marketplace is
// connected to this project — no manual config needed.
const redis = Redis.fromEnv();

export type Location = "gallery" | "office";

export interface DayRecord {
  gallery: number | null;
  galleryAt: string | null; // ISO timestamp
  office: number | null;
  officeAt: string | null;
  smsSent: boolean;
}

function emptyRecord(): DayRecord {
  return { gallery: null, galleryAt: null, office: null, officeAt: null, smsSent: false };
}

function keyFor(dateKey: string): string {
  return `benitagold:meal-record:${dateKey}`;
}

export async function getTodayRecord(): Promise<{ dateKey: string; record: DayRecord }> {
  const dateKey = getTehranDateKey();
  const existing = await redis.get<DayRecord>(keyFor(dateKey));
  return { dateKey, record: existing ?? emptyRecord() };
}

export async function saveTodayRecord(dateKey: string, record: DayRecord): Promise<void> {
  // Keep each day's key around for 3 days, then let it expire automatically —
  // we never need yesterday's counts, and this keeps storage from growing forever.
  await redis.set(keyFor(dateKey), record, { ex: 60 * 60 * 24 * 3 });
}

/**
 * Records one location's count for today. Returns the updated record plus
 * whether this submission just completed the pair (both locations in).
 */
export async function recordSubmission(
  location: Location,
  count: number
): Promise<{ record: DayRecord; justCompleted: boolean }> {
  const { dateKey, record } = await getTodayRecord();

  const wasComplete = record.gallery !== null && record.office !== null;

  record[location] = count;
  record[`${location}At`] = new Date().toISOString();

  const isCompleteNow = record.gallery !== null && record.office !== null;
  const justCompleted = isCompleteNow && !wasComplete;

  await saveTodayRecord(dateKey, record);

  return { record, justCompleted };
}

export async function markSmsSent(): Promise<void> {
  const { dateKey, record } = await getTodayRecord();
  record.smsSent = true;
  await saveTodayRecord(dateKey, record);
}
