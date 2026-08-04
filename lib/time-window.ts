/**
 * Ordering window rules for برنامه غذایی روزانه بنیتاگلد
 * Open: Saturday-Wednesday, 09:00-11:00, Asia/Tehran time.
 *
 * IMPORTANT: This must be evaluated in Asia/Tehran time regardless of where
 * the server or the visitor's browser is physically located, otherwise a
 * server deployed in another timezone (e.g. UTC) would open/close the form
 * at the wrong moment. We use Intl.DateTimeFormat with an explicit
 * timeZone instead of relying on Date.getDay()/getHours().
 */

// JS convention: 0=Sunday ... 6=Saturday
const ALLOWED_WEEKDAYS = new Set([6, 0, 1, 2, 3]); // شنبه تا چهارشنبه
const OPEN_HOUR = 9; // 09:00
const CLOSE_HOUR = 11; // 11:00 (exclusive)
const TIMEZONE = "Asia/Tehran";

const WEEKDAY_LABELS_FA: Record<number, string> = {
  0: "یکشنبه",
  1: "دوشنبه",
  2: "سه‌شنبه",
  3: "چهارشنبه",
  4: "پنجشنبه",
  5: "جمعه",
  6: "شنبه",
};

export interface TehranClock {
  weekday: number; // 0-6, JS convention
  hour: number;
  minute: number;
  weekdayLabel: string;
  isoLikeString: string; // e.g. "1405/05/... " not used for date math, only display fallback
}

/** Reads the current wall-clock time in Asia/Tehran without any external date library. */
export function getTehranClock(date: Date = new Date()): TehranClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  // en-US hour12:false can report "24" for midnight in some environments; normalize.
  if (hour === 24) hour = 0;

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[weekdayShort] ?? 0;

  return {
    weekday,
    hour,
    minute,
    weekdayLabel: WEEKDAY_LABELS_FA[weekday],
    isoLikeString: date.toISOString(),
  };
}

export interface WindowStatus {
  isOpen: boolean;
  clock: TehranClock;
  message: string;
}

/** Single source of truth for "is the ordering window open right now". */
export function getOrderWindowStatus(date: Date = new Date()): WindowStatus {
  const clock = getTehranClock(date);
  const dayOk = ALLOWED_WEEKDAYS.has(clock.weekday);
  const timeOk = clock.hour >= OPEN_HOUR && clock.hour < CLOSE_HOUR;
  const isOpen = dayOk && timeOk;

  const message = isOpen
    ? "ثبت سفارش هم‌اکنون فعال است."
: "ثبت سفارش فقط از شنبه تا چهارشنبه، ساعت ۹ تا ۱۱ فعال است.";

  return { isOpen, clock, message };
}

export function formatTehranTimestamp(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: TIMEZONE,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

/** A stable YYYY-MM-DD key (in Tehran time) used to group today's two submissions together. */
export function getTehranDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
/** True if today is one of the allowed ordering weekdays (Sat–Wed) in Tehran time. */
export function isOrderDayToday(date: Date = new Date()): boolean {
  const clock = getTehranClock(date);
  return ALLOWED_WEEKDAYS.has(clock.weekday);
}
/**
 * Official Iranian public holidays (Tehran-local YYYY-MM-DD dates).
 * Add new dates here as "YYYY-MM-DD" strings — one per line, any order.
 * These override the normal Sat–Wed schedule: the site stays closed even
 * if the holiday falls on an otherwise-open weekday.
 */
const HOLIDAY_DATES = new Set<string>([
  "2026-08-04", // اربعین حسینی
  "2026-08-12", // رحلت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)
  "2026-08-30", // میلاد رسول اکرم (ص) و امام جعفر صادق (ع)
  "2026-12-23", // ولادت امام علی (ع) و روز پدر
  "2027-01-06", // مبعث رسول اکرم (ص)
  "2027-02-28", // شهادت حضرت علی (ع)
  "2027-03-10", // عید سعید فطر
  "2027-03-20", // روز ملی شدن صنعت نفت ایران
]);

/** True if the given date (Tehran-local) is an official holiday. */
export function isHolidayToday(date: Date = new Date()): boolean {
  return HOLIDAY_DATES.has(getTehranDateKey(date));
}
