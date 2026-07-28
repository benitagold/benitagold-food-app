import { NextRequest, NextResponse } from "next/server";
import { isOrderDayToday } from "@/lib/time-window";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

const RECIPIENTS = [
  { name: "آقای مراثی", phone: "09132099904" },
  { name: "خانم گنجوی", phone: "09134728044" },
  { name: "آقای فقیهی", phone: "09132685421" },
];

const OPEN_MESSAGE =
  "🔔 سلام! سایت ثبت غذای روزانه بنیتاگلد الان باز شد. لطفاً تا ساعت ۱۱ تعداد غذای امروز رو ثبت کنید. 🍽️";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isOrderDayToday()) {
    return NextResponse.json({ ok: true, skipped: "امروز روز سفارش نیست" });
  }

  const results = await Promise.all(
    RECIPIENTS.map(async (r) => {
      const result = await sendSms({ to: r.phone, message: OPEN_MESSAGE });
      return { name: r.name, ok: result.ok, error: result.error };
    })
  );

  const anyFailed = results.some((r) => !r.ok);

  return NextResponse.json({ ok: !anyFailed, results });
}
