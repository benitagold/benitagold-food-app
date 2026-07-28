import { NextRequest, NextResponse } from "next/server";
import { getTodayRecord } from "@/lib/day-record";
import { isOrderDayToday } from "@/lib/time-window";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

const MARASI_PHONE = "09132099904";
const WARNING_MESSAGE =
  "⏰ سلام آقای مراثی جان! ساعت داره از ۱۰:۱۵ رد می‌شه و هنوز خبری از تعداد غذای گالری نیست 😅 یه لحظه وقت بذارید و ثبتش کنید تا بقیه بی‌غذا نمونن 🍽️⚠️";

export async function GET(req: NextRequest) {
  // Only Vercel's own scheduler (with the secret) is allowed to trigger this.
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isOrderDayToday()) {
    return NextResponse.json({ ok: true, skipped: "امروز روز سفارش نیست" });
  }

  const { record } = await getTodayRecord();

  if (record.gallery !== null) {
    return NextResponse.json({ ok: true, skipped: "عدد گالری قبلاً ثبت شده" });
  }

  const smsResult = await sendSms({ to: MARASI_PHONE, message: WARNING_MESSAGE });

  if (!smsResult.ok) {
    console.error("Reminder SMS failed:", smsResult.error);
    return NextResponse.json(
      { ok: false, error: smsResult.error ?? "خطای نامشخص" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}
