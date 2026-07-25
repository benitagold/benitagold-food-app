"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getOrderWindowStatus, formatTehranTimestamp } from "@/lib/time-window";

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; total: number; galleryCount: number; officeCount: number; timestampFa: string }
  | { phase: "error"; message: string };

function NumberField({
  label,
  responsibleName,
  value,
  onChange,
  disabled,
  id,
}: {
  label: string;
  responsibleName: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink/80">{label}</span>
        <span className="text-xs text-ink/50">مسئول: {responsibleName}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        placeholder="۰"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-full rounded-xl border-2 border-ink/15 bg-white/70 px-4 py-3 text-lg font-semibold text-ink outline-none transition focus:border-gold disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export default function Page() {
  const [status, setStatus] = useState(() => getOrderWindowStatus());
  const [galleryValue, setGalleryValue] = useState("");
  const [officeValue, setOfficeValue] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: "idle" });

  // Keep the open/closed state fresh without requiring a page reload.
  useEffect(() => {
    const id = setInterval(() => setStatus(getOrderWindowStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  const galleryNum = Number(galleryValue);
  const officeNum = Number(officeValue);
  const galleryValid = Number.isInteger(galleryNum) && galleryNum > 0;
  const officeValid = Number.isInteger(officeNum) && officeNum > 0;
  const total = (galleryValid ? galleryNum : 0) + (officeValid ? officeNum : 0);

  const canSubmit =
    status.isOpen && galleryValid && officeValid && submitState.phase !== "submitting";

  const formError = useMemo(() => {
    if (galleryValue !== "" && !galleryValid) return "تعداد غذای گالری باید عدد صحیح مثبت باشد.";
    if (officeValue !== "" && !officeValid) return "تعداد غذای دفتر باید عدد صحیح مثبت باشد.";
    return null;
  }, [galleryValue, officeValue, galleryValid, officeValid]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitState({ phase: "submitting" });

    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch("/api/submit-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryCount: galleryNum,
          officeCount: officeNum,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setSubmitState({ phase: "error", message: data.error ?? "ثبت سفارش ناموفق بود." });
        return;
      }

      setSubmitState({
        phase: "success",
        total: data.total,
        galleryCount: data.galleryCount,
        officeCount: data.officeCount,
        timestampFa: data.timestampFa,
      });
      setGalleryValue("");
      setOfficeValue("");
    } catch {
      setSubmitState({
        phase: "error",
        message: "برقراری ارتباط با سرور ناموفق بود. اتصال اینترنت خود را بررسی کنید.",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
                <Image
          src="/logo.png"
          alt="بنیتاگلد"
                    width={220}
          height={140}
          priority
          className="h-auto w-96 sm:w-80"
        />

        <span
          className={`status-stamp ${status.isOpen ? "text-open" : "text-closed"}`}
          aria-live="polite"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${status.isOpen ? "bg-open" : "bg-closed"}`}
          />
          {status.isOpen ? "پذیرش سفارش: باز است" : "پذیرش سفارش: بسته است"}
        </span>

        <h1 className="text-3xl font-extrabold text-gold sm:text-4xl">
          برنامه غذایی روزانه بنیتاگلد
        </h1>
        <p className="max-w-md text-sm leading-7 text-ink/65">
          تعداد غذای مورد نیاز گالری و دفتر را وارد کنید تا به‌صورت خودکار برای هماهنگی ثبت و ارسال شود.
        </p>
        <p className="text-xs text-ink/50">{status.message}</p>
      </header>

      <section className="w-full rounded-3xl bg-paper p-6 text-ink shadow-ticket sm:p-8">
        <div className="mb-6 flex items-center justify-between border-b-2 border-dashed border-ink/15 pb-4">
          <h2 className="text-lg font-bold">فرم ثبت تعداد غذا</h2>
          <span className="text-xs text-ink/45">امروز: {status.clock.weekdayLabel}</span>
        </div>

        <div className="flex flex-col gap-5">
          <NumberField
            id="gallery-count"
            label="تعداد غذای روز گالری بنیتا گلد"
            responsibleName="جناب آقای مراثی"
            value={galleryValue}
            onChange={setGalleryValue}
            disabled={!status.isOpen || submitState.phase === "submitting"}
          />
          <NumberField
            id="office-count"
            label="تعداد غذای دفتر حکیم بنیتا گلد"
            responsibleName="سرکار خانم گنجوی"
            value={officeValue}
            onChange={setOfficeValue}
            disabled={!status.isOpen || submitState.phase === "submitting"}
          />

          {formError && <p className="text-sm font-medium text-closed">{formError}</p>}

          <div className="flex items-center justify-between rounded-xl bg-board px-5 py-4 text-paper">
            <span className="text-sm font-medium text-paper/70">جمع کل غذا</span>
            <span className="tabular text-2xl font-extrabold text-gold">{total}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-gold py-3.5 text-base font-bold text-ink transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40"
          >
            {submitState.phase === "submitting" ? "در حال ثبت..." : "ثبت نهایی"}
          </button>

          {submitState.phase === "success" && (
            <div className="rounded-xl border-2 border-open bg-open/10 p-4 text-sm leading-7 text-ink">
              <p className="font-bold text-open">سفارش با موفقیت ثبت و پیامک ارسال شد.</p>
              <p>گالری: {submitState.galleryCount} — دفتر: {submitState.officeCount} — جمع کل: {submitState.total}</p>
              <p className="text-ink/60">{submitState.timestampFa}</p>
            </div>
          )}

          {submitState.phase === "error" && (
            <div className="rounded-xl border-2 border-closed bg-closed/10 p-4 text-sm font-medium leading-7 text-closed">
              {submitState.message}
            </div>
          )}

          {!status.isOpen && (
            <p className="text-center text-xs text-ink/50">
              فرم غیرفعال است. لطفاً در بازه فعال (شنبه تا چهارشنبه، ساعت ۱۲ تا ۱۵) مراجعه کنید.
            </p>
          )}
        </div>
      </section>

      <footer className="text-xs text-ink/35">
        آخرین به‌روزرسانی وضعیت: {formatTehranTimestamp()}
      </footer>
    </main>
  );
}
