import { NextRequest, NextResponse } from "next/server";
import { getOrderWindowStatus, formatTehranTimestamp } from "@/lib/time-window";
import { sendSms, buildMealReportMessage } from "@/lib/sms";
import { checkAndRegisterSubmission } from "@/lib/rate-limit";

export const runtime = "nodejs";

const TARGET_PHONE = "09131885395";
const MAX_MEALS_PER_FIELD = 1000;

interface RequestBody {
  galleryCount: unknown;
  officeCount: unknown;
  idempotencyKey: unknown;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
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

  const { galleryCount, officeCount, idempotencyKey } = body;

  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    return NextResponse.json(
      { ok: false, error: "درخواست نامعتبر است (شناسه ثبت یافت نشد)." },
      { status: 400 }
    );
  }

  if (
    !isPositiveInteger(galleryCount) ||
    !isPositiveInteger(officeCount) ||
    galleryCount > MAX_MEALS_PER_FIELD ||
    officeCount > MAX_MEALS_PER_FIELD
  ) {
    return NextResponse.json(
      { ok: false, error: "تعداد غذا باید یک عدد صحیح مثبت و منطقی باشد." },
      { status: 400 }
    );
  }

  const windowStatus = getOrderWindowStatus();
  if (!windowStatus.isOpen) {
    return NextResponse.json({ ok: false, error: windowStatus.message }, { status: 403 });
  }

  const clientKey = getClientKey(req);
  const guard = checkAndRegisterSubmission(clientKey, idempotencyKey);
  if (!guard.allowed) {
    return NextResponse.json(
      { ok: false, error: guard.reason ?? "درخواست تکراری است." },
      { status: 429 }
    );
  }

  const total = galleryCount + officeCount;
  const timestampFa = formatTehranTimestamp();

  const message = buildMealReportMessage({ galleryCount, officeCount, total, timestampFa });

  const smsResult = await sendSms({ to: TARGET_PHONE, message });

  if (!smsResult.ok) {
    console.error("SMS send failed:", {
      error: smsResult.error,
      statusCode: smsResult.statusCode,
      raw: smsResult.raw,
    });
    return NextResponse.json(
      { ok: false, error: `ثبت انجام شد اما ارسال پیامک ناموفق بود: ${smsResult.error ?? "خطای نامشخص"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    total,
    galleryCount,
    officeCount,
    timestampFa,
  });
}
