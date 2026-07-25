import { NextResponse } from "next/server";
import { getTodayRecord } from "@/lib/day-record";

export const runtime = "nodejs";

export async function GET() {
  const { record } = await getTodayRecord();

  // Deliberately expose only booleans, never the actual counts, since this
  // endpoint requires no password.
  return NextResponse.json({
    gallerySubmitted: record.gallery !== null,
    officeSubmitted: record.office !== null,
    smsSent: record.smsSent,
  });
}
