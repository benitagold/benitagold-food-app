"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getOrderWindowStatus, formatTehranTimestamp } from "@/lib/time-window";

type Location = "gallery" | "office" | "marketing";

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "waiting"; count: number; waitingFor: string }
  | { phase: "complete"; total: number; galleryCount: number; officeCount: number }
  | { phase: "error"; message: string };

interface DayStatus {
  gallerySubmitted: boolean;
  officeSubmitted: boolean;
  marketingSubmitted: boolean;
  smsSent: boolean;
}

function LocationCard({
  location,
  title,
  responsibleName,
  disabled,
  alreadySubmittedToday,
}: {
  location: Location;
  title: string;
  responsibleName: string;
  disabled: boolean;
  alreadySubmittedToday: boolean;
}) {
  const [password, setPassword] = useState("");
  const [countValue, setCountValue] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: "idle" });

  const countNum = Number(countValue);
  const countValid = Number.isInteger(countNum) && countNum >= 0;
  const canSubmit =
    !disabled && password.length > 0 && countValid && submitState.phase !== "submitting";

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitState({ phase: "submitting" });

    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch("/api/submit-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, password, count: countNum, idempotencyKey }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setSubmitState({ phase: "error", message: data.error ?? "ثبت ناموفق بود." });
        return;
      }

      if (data.waiting) {
        setSubmitState({ phase: "waiting", count: countNum, waitingFor: data.waitingFor });
      } else {
        setSubmitState({
          phase: "complete",
          total: data.total,
          galleryCount: data.galleryCount,
          officeCount: data.officeCount,
        });
      }
      setCountValue("");
      setPassword("");
    } catch {
      setSubmitState({
        phase: "error",
        message: "برقراری ارتباط با سرور ناموفق بود. اتصال اینترنت را بررسی کنید.",
      });
    }
  }

  return (
    <section className="w-full rounded-3xl bg-paper p-6 text-ink shadow-ticket sm:p-8">
      <div className="mb-6 flex items-center justify-between border-b-2 border-dashed border-ink/15 pb-4">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-xs text-ink/50">مسئول: {responsibleName}</p>
        </div>
        {alreadySubmittedToday && (
          <span className="rounded-full bg-open/15 px-3 py-1 text-xs font-semibold text-open">
            امروز ثبت شده ✓
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${location}-password`} className="text-sm font-semibold text-ink/80">
            رمز عبور
          </label>
          <input
            id={`${location}-password`}
            type="password"
            value={password}
            disabled={disabled || submitState.phase === "submitting"}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-ink/15 bg-white/70 px-4 py-3 text-lg outline-none transition focus:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="رمز خودتان را وارد کنید"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${location}-count`} className="text-sm font-semibold text-ink/80">
            تعداد غذا
          </label>
          <input
            id={`${location}-count`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={countValue}
            disabled={disabled || submitState.phase === "submitting"}
            onChange={(e) => setCountValue(e.target.value)}
            className="tabular w-full rounded-xl border-2 border-ink/15 bg-white/70 px-4 py-3 text-lg font-semibold outline-none transition focus:border-gold disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="۰"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-gold py-3.5 text-base font-bold text-ink transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40"
        >
          {submitState.phase === "submitting" ? "در حال ثبت..." : "ثبت"}
        </button>

        {submitState.phase === "waiting" && (
          <div className="rounded-xl border-2 border-gold bg-gold/10 p-4 text-sm leading-7 text-ink">
            <p className="font-bold text-ink">عدد شما ({submitState.count}) با موفقیت ثبت شد.</p>
            <p className="text-ink/60">
              منتظر ثبت «{submitState.waitingFor}» هستیم — به‌محض ثبت آن، پیامک نهایی با جمع کل ارسال می‌شود.
            </p>
          </div>
        )}

        {submitState.phase === "complete" && (
          <div className="rounded-xl border-2 border-open bg-open/10 p-4 text-sm leading-7 text-ink">
            <p className="font-bold text-open">هر سه بخش ثبت شد و پیامک نهایی ارسال شد.</p>
            <p>
              گالری: {submitState.galleryCount} — دفتر: {submitState.officeCount} — جمع کل: {submitState.total}
            </p>
          </div>
        )}

        {submitState.phase === "error" && (
          <div className="rounded-xl border-2 border-closed bg-closed/10 p-4 text-sm font-medium leading-7 text-closed">
            {submitState.message}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Page() {
  const [status, setStatus] = useState(() => getOrderWindowStatus());
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);

  useEffect(() => {
    const id = setInterval(() => setStatus(getOrderWindowStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDayStatus(data);
      })
      .catch(() => {
        /* non-critical — the page still works without this */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
        <Image
  src="/logo.png"
  alt="بنیتاگلد"
  width={300}
  height={190}
  priority
  className="h-auto w-80 sm:w-[26rem]"
/>

        <span
  className={`status-stamp mb-8 ${status.isOpen ? "text-open" : "text-closed"}`}
  aria-live="polite"
>
          <span
            className={`h-2.5 w-2.5 rounded-full ${status.isOpen ? "bg-open" : "bg-closed"}`}
          />
          {status.isHoliday
            ? `امروز ${status.holidayName} است`
            : status.isOpen
            ? "پذیرش سفارش: باز است"
            : "پذیرش سفارش: بسته است"}
        </span>

        <h1 className="text-3xl font-extrabold text-gold sm:text-4xl">
          برنامه غذایی روزانه بنیتاگلد
        </h1>
        <p className="max-w-md text-sm leading-7 text-ink/65">
          هر مسئول با رمز خودش تعداد غذای بخش خودش را ثبت می‌کند. به‌محض ثبت هر سه بخش، پیامک جمع کل خودکار ارسال می‌شود.
        </p>
        <p className="text-xs text-ink/50">{status.message}</p>
      </header>

      <LocationCard
        location="gallery"
        title="تعداد غذای روز گالری بنیتا گلد"
        responsibleName="جناب آقای مراثی"
        disabled={!status.isOpen}
        alreadySubmittedToday={dayStatus?.gallerySubmitted ?? false}
      />

      <LocationCard
        location="office"
        title="تعداد غذای دفتر حکیم بنیتا گلد"
        responsibleName="سرکار خانم گنجوی"
        disabled={!status.isOpen}
        alreadySubmittedToday={dayStatus?.officeSubmitted ?? false}
      />

      <LocationCard
        location="marketing"
        title="تعداد غذای دفتر دیجیتال مارکتینگ حکیم بنیتا گلد"
        responsibleName="جناب آقای فقیهی"
        disabled={!status.isOpen}
        alreadySubmittedToday={dayStatus?.marketingSubmitted ?? false}
      />

      <footer className="text-xs text-ink/35">
        آخرین به‌روزرسانی وضعیت: {formatTehranTimestamp()}
      </footer>
    </main>
  );
}
