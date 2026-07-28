import { NextRequest, NextResponse } from "next/server";
import { getTodayRecord, type Location } from "@/lib/day-record";
import { isOrderDayToday } from "@/lib/time-window";
import { sendSms } from "@/lib/sms";

export const runtime = "nodejs";

interface Person {
  location: Location;
  honorific: string;
  locationLabel: string;
  phone: string;
}

const PEOPLE: Person[] = [
  {
    location: "gallery",
    honorific: "آقای مراثی",
    locationLabel: "تعداد غذای گالری بنیتا گلد",
    phone: "09132099904",
  },
  {
    location: "office",
    honorific: "خانم گنجوی",
    locationLabel: "تعداد غذای دفتر فروش حکیم بنیتا گلد",
    phone: "09134728044",
  },
  {
    location: "marketing",
    honorific: "آقای فقیهی",
    locationLabel: "تعداد غذای دفتر دیجیتال مارکتینگ حکیم بنیتا گلد",
    phone: "09132685421",
  },
];

// پله ۱ تا ۱۱ معادل ساعات ۱۰:۰۰، ۱۰:۱۰، ۱۰:۱۵، ۱۰:۲۰، ۱۰:۲۵، ۱۰:۳۰، ۱۰:۳۵، ۱۰:۴۰، ۱۰:۴۵، ۱۰:۵۰، ۱۰:۵۵
const LADDER: ((h: string, loc: string) => string)[] = [
  (h, loc) => `⏰ سلام ${h} جان! یادآوری می‌کنم که هنوز ${loc} امروز ثبت نشده. وقت داری، فقط یادت نره 🙂`,
  (h, loc) => `⏰ سلام ${h}! هنوز ${loc} ثبت نشده. یه لحظه وقت بذار و ثبتش کن 😊`,
  (h, loc) => `🔔 ${h} جان، هنوز خبری از ثبت ${loc} نیست. الان وقت خوبیه که ثبتش کنی.`,
  (h, loc) => `⚠️ ${h}، تا الان ${loc} ثبت نشده. لطفاً هرچه زودتر ثبت کن.`,
  (h, loc) => `⚠️ ${h} جان، وقت داره کم می‌شه و ${loc} هنوز ثبت نشده. لطفاً الان ثبت کن.`,
  (h, loc) => `⏳ ${h}، نصف وقت گذشت و ${loc} هنوز خالیه! لطفاً همین الان ثبت کن.`,
  (h, loc) => `🚨 ${h} جان، این یادآوری مهمه: ${loc} هنوز ثبت نشده. زمان داره تموم می‌شه.`,
  (h, loc) => `🚨 ${h}، لطفاً توجه کن — فقط چند دقیقه وقت مونده و ${loc} هنوز ثبت نشده!`,
  (h, loc) => `‼️ ${h} جان، فوریه! تا ساعت ۱۱ فقط ۱۵ دقیقه مونده و ${loc} هنوز ثبت نشده.`,
  (h, loc) => `‼️ ${h}، این از آخرین یادآوری‌هاست! لطفاً همین الان ${loc} رو ثبت کن، وگرنه بازه بسته می‌شه.`,
  (h, loc) => `🆘 ${h} جان، این آخرین فرصته! فقط ۵ دقیقه تا بسته شدن بازه ثبت مونده. همین الان ${loc} رو ثبت کن!`,
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!process.env.REMINDER_SECRET || key !== process.env.REMINDER_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const step = Number(searchParams.get("step"));
  if (!Number.isInteger(step) || step < 1 || step > LADDER.length) {
    return NextResponse.json(
      { ok: false, error: `Invalid step (must be 1-${LADDER.length})` },
      { status: 400 }
    );
  }

  if (!isOrderDayToday()) {
    return NextResponse.json({ ok: true, skipped: "امروز روز سفارش نیست" });
  }

  const { record } = await getTodayRecord();
  const buildMessage = LADDER[step - 1];

  const results = await Promise.all(
    PEOPLE.map(async (p) => {
      if (record[p.location] !== null) {
        return { location: p.location, skipped: "قبلاً ثبت شده" };
      }
      const message = buildMessage(p.honorific, p.locationLabel);
      const result = await sendSms({ to: p.phone, message });
      return { location: p.location, ok: result.ok, error: result.error };
    })
  );

  return NextResponse.json({ ok: true, step, results });
}
