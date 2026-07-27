import { Redis } from "@upstash/redis";
import { getTehranDateKey } from "@/lib/time-window";

// Vercel's "Upstash for Redis" marketplace integration provisions these
// exact env var names (KV_REST_API_URL / KV_REST_API_TOKEN) automatically
// once the database is connected to this project — no manual config needed.
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

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

export async function recordSubmission(
  location: Location,
  count: number
): Promise<{ record: DayRecord; justCompleted: boolean }> {
  const { dateKey, record } = await getTodayRecord();
  const wasComplete = record.gallery !== null && record.office !== null;

  record[location] = count;
  (record as any)[`${location}At`] = new Date().toISOString();

  const isComplete = record.gallery !== null && record.office !== null;
  const justCompleted = isComplete && !wasComplete;

  await saveTodayRecord(dateKey, record);

  return { record, justCompleted };
}export async function markSmsSent(dateKey: string): Promise<void> {
  const key = keyFor(dateKey);
  const existing = await redis.get<DayRecord>(key);
  if (!existing) return;
  existing.smsSent = true;
  await saveTodayRecord(dateKey, existing);
}
