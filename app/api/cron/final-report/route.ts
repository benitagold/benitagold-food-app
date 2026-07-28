import { NextRequest, NextResponse } from "next/server";
import { getTodayRecord, markSmsSent } from "@/lib/day-record";
import { isOrderDayToday, formatTehranTimestamp } from "@/lib/time-window";
import { sendSms, buildMealReportMessage, buildPartialMealReportMessage } from "@/lib/sms";

export const runtime = "nodejs";

const TARGET_PHONE = "09131885395";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isOrderDayToday()) {
    return NextResponse.json({ ok: true, skipped: "امروز روز سفارش نیست" });
  }

  const { dateKey, record } = await getTodayRecord();

  // Already sent (either by a normal completion earlier, or by this cron
  // running twice due to a retry) — never send twice.
  if (record.smsSent) {
    return NextResponse.json({ ok: true, skipped: "پیامک قبلاً ارسال شده" });
  }

  const timestampFa = formatTehranTimestamp();
  const allComplete =
    record.gallery !== null && record.office !== null && record.marketing !== null;

  const message = allComplete
    ? buildMealReportMessage({
        galleryCount: record.gallery!,
        officeCount: record.office!,
        marketingCount: record.marketing!,
        total: record.gallery! + record.office! + record.marketing!,
        timestampFa,
      })
    : buildPartialMealReportMessage({
        galleryCount: record.gallery,
        officeCount: record.office,
        marketingCount: record.marketing,
        timestampFa,
      });

  const smsResult = await sendSms({ to: TARGET_PHONE, message });

  if (!smsResult.ok) {
    console.error("Final report SMS failed:", smsResult.error);
    return NextResponse.json({ ok: false, error: smsResult.error }, { status: 502 });
  }

  await markSmsSent(dateKey);

  return NextResponse.json({ ok: true, sent: true, allComplete });
}
