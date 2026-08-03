import { NextRequest, NextResponse } from "next/server";
import { getOrderWindowStatus, formatTehranTimestamp } from "@/lib/time-window";
import { sendSms, buildMealReportMessage } from "@/lib/sms";
import { checkAndRegisterSubmission } from "@/lib/rate-limit";
import { recordSubmission, markSmsSent, type Location } from "@/lib/day-record";

export const runtime = "nodejs";

const TARGET_PHONE = "09131885395";
const MAX_MEALS_PER_FIELD = 1000;

const LOCATION_LABELS: Record<Location, string> = {
  gallery: "گالری بنیتا گلد",
  office: "دفتر حکیم بنیتا گلد",
  marketing: "دفتر دیجیتال مارکتینگ حکیم بنیتا گلد",
};

interface RequestBody {
  location: unknown;
  password: unknown;
  count: unknown;
  idempotencyKey: unknown;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function getExpectedPassword(location: Location): string | undefined {
  if (location === "gallery") return process.env.GALLERY_PASSWORD;
  if (location === "office") return process.env.OFFICE_PASSWORD;
  return process.env.MARKETING_PASSWORD;
}
function getClientKey(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown-client";
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "بدنه درخواست نامعتبر است." }, { status: 400 });
  }

  const { location, password, count, idempotencyKey } = body;

if (location !== "gallery" && location !== "office" && location !== "marketing") {
    return NextResponse.json({ ok: false, error: "محل نامعتبر است." }, { status: 400 });
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    return NextResponse.json(
      { ok: false, error: "درخواست نامعتبر است (شناسه ثبت یافت نشد)." },
      { status: 400 }
    );
  }

  if (!isPositiveInteger(count) || count > MAX_MEALS_PER_FIELD) {
    return NextResponse.json(
      { ok: false, error: "تعداد غذا باید یک عدد صحیح مثبت و منطقی باشد." },
      { status: 400 }
    );
  }

  // Server-side time-window check — never trust the client's clock.
  const windowStatus = getOrderWindowStatus();
  if (!windowStatus.isOpen) {
    return NextResponse.json({ ok: false, error: windowStatus.message }, { status: 403 });
  }

  // Password check.
  const expectedPassword = getExpectedPassword(location);
  if (!expectedPassword) {
    console.error(`Missing password env var for location "${location}"`);
    return NextResponse.json(
      { ok: false, error: "رمز این بخش هنوز روی سرور تنظیم نشده است." },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || password !== expectedPassword) {
    return NextResponse.json({ ok: false, error: "رمز عبور اشتباه است." }, { status: 401 });
  }

  // Duplicate / rapid-fire submission guard (per location + client).
  const clientKey = `${getClientKey(req)}:${location}`;
  const guard = checkAndRegisterSubmission(clientKey, idempotencyKey);
  if (!guard.allowed) {
    return NextResponse.json(
      { ok: false, error: guard.reason ?? "درخواست تکراری است." },
      { status: 429 }
    );
  }

  // Save this location's count for today.
const { record, justCompleted, dateKey } = await recordSubmission(location as Location, count);

// Still waiting on other locations.
  if (record.gallery === null || record.office === null || record.marketing === null) {
    const missing: string[] = [];
    if (record.gallery === null) missing.push(LOCATION_LABELS.gallery);
    if (record.office === null) missing.push(LOCATION_LABELS.office);
    if (record.marketing === null) missing.push(LOCATION_LABELS.marketing);

    return NextResponse.json({
      ok: true,
      waiting: true,
      location,
      count,
      waitingFor: missing.join(" و "),
    });
  }
  // Both are in. Send the combined SMS, but only once (guarded by smsSent).
  if (justCompleted && !record.smsSent) {
const total = record.gallery + record.office + record.marketing;
    const timestampFa = formatTehranTimestamp();

    const message = buildMealReportMessage({
      galleryCount: record.gallery,
      officeCount: record.office,
      marketingCount: record.marketing,
      total,
      timestampFa,
    });

    const smsResult = await sendSms({ to: TARGET_PHONE, message });

    if (!smsResult.ok) {
      console.error("SMS send failed:", {
        error: smsResult.error,
        statusCode: smsResult.statusCode,
        raw: smsResult.raw,
      });
      return NextResponse.json(
        {
          ok: false,
          error: `عدد شما ثبت شد، هر دو بخش کامل شدند، اما ارسال پیامک ناموفق بود: ${
            smsResult.error ?? "خطای نامشخص"
          }`,
        },
        { status: 502 }
      );
    }

await markSmsSent(dateKey);

return NextResponse.json({
      ok: true,
      waiting: false,
      justCompleted: true,
      total,
      galleryCount: record.gallery,
      officeCount: record.office,
marketingCount: record.marketing,
      timestampFa,
    });
  }

  // Both were already in from a previous submission (e.g. someone re-submitted
  // to correct a number) — don't re-send the SMS, just confirm the save.
  return NextResponse.json({
    ok: true,
    waiting: false,
    justCompleted: false,
    total: record.gallery + record.office + record.marketing,
galleryCount: record.gallery,
    officeCount: record.office,
    marketingCount: record.marketing,
  });
}
