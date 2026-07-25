/**
 * Adapter for the IranPayamak / FarazSMS "Send Simple SMS" endpoint.
 *
 * Confirmed from the account's own API docs (OpenAPI spec):
 *   POST https://api.iranpayamak.com/ws/v1/sms/simple
 *   Header: Api-Key: <API key>
 *   Body (JSON): {
 *     text: string,
 *     line_number: string,      // the approved sender line
 *     recipients: string[],     // array of destination phone numbers
 *     number_format: "english" | "persian",
 *     schedule: string | null   // null = send immediately
 *   }
 *   Success response: HTTP 201, body { status: "success", data: <id>, messages: null }
 */

const SMS_ENDPOINT = "https://api.iranpayamak.com/ws/v1/sms/simple";

export interface SmsPayload {
  to: string;
  message: string;
}

export interface SmsResult {
  ok: boolean;
  statusCode?: number;
  raw?: unknown;
  error?: string;
}

function readEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Set it in your .env.local ` +
        `(see .env.example) — never hard-code SMS credentials in source.`
    );
  }
  return value;
}

interface IranPayamakResponse {
  status?: "success" | "error";
  data?: number;
  messages?: string | string[] | Record<string, string | string[]> | null;
}

function buildRequest(payload: SmsPayload): { url: string; init: RequestInit } {
  const apiKey = readEnvOrThrow("IRANPAYAMAK_API_KEY"); // set in .env.local
  const lineNumber = readEnvOrThrow("IRANPAYAMAK_LINE_NUMBER"); // approved sender line, set in .env.local

  const body = {
    text: payload.message,
    line_number: lineNumber,
    recipients: [payload.to],
    number_format: "english",
    schedule: null,
  };

  return {
    url: SMS_ENDPOINT,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    },
  };
}

function flattenMessages(messages: IranPayamakResponse["messages"]): string | undefined {
  if (!messages) return undefined;
  if (typeof messages === "string") return messages;
  if (Array.isArray(messages)) return messages.join(" — ");
  return Object.entries(messages)
    .map(([field, val]) => `${field}: ${Array.isArray(val) ? val.join(", ") : val}`)
    .join(" | ");
}

export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  try {
    const { url, init } = buildRequest(payload);
    const response = await fetch(url, init);

    let raw: IranPayamakResponse | undefined;
    try {
      raw = await response.json();
    } catch {
      raw = undefined;
    }

    if (!response.ok) {
      const detail = raw ? flattenMessages(raw.messages) ?? JSON.stringify(raw) : undefined;
      return {
        ok: false,
        statusCode: response.status,
        raw,
        error: `SMS gateway responded with HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
      };
    }

    if (raw?.status === "error") {
      return {
        ok: false,
        statusCode: response.status,
        raw,
        error: flattenMessages(raw.messages) ?? "سرویس پیامک خطای نامشخصی برگرداند.",
      };
    }

    return { ok: true, statusCode: response.status, raw };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "TimeoutError" || err.name === "AbortError"
          ? "زمان اتصال به سرویس پیامک تمام شد (timeout)."
          : err.message
        : "خطای ناشناخته در ارسال پیامک";

    return { ok: false, error };
  }
}

export function buildMealReportMessage(input: {
  galleryCount: number;
  officeCount: number;
  total: number;
  timestampFa: string;
}): string {
  const { galleryCount, officeCount, total, timestampFa } = input;
  return [
    "برنامه غذایی روزانه بنیتاگلد",
    `تعداد غذای گالری بنیتا گلد (آقای مراثی): ${galleryCount}`,
    `تعداد غذای دفتر حکیم بنیتا گلد (خانم گنجوی): ${officeCount}`,
    `جمع کل: ${total}`,
    `تاریخ و ساعت ثبت: ${timestampFa}`,
  ].join("\n");
}