"use client";

import { useState, useTransition } from "react";
import { setPayment } from "@/app/actions";
import { PAYMENT_METHODS, effectiveMethod, methodInfo } from "@/lib/payment-methods";

type Props = {
  tripId: number;
  itemType: string;
  itemId: number | null;
  paymentId: number | null;
  paid: boolean;
  method: string | null;
  partnerPaid: boolean;
  shared: boolean;
  cancelUntil: string | null;
  amount: number | null;
  defaultAmount: number | null;
  partnerName: string;
  today: string;
};

const eur = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);

/** Bezahlt / Stornofrist / Anteil überwiesen – speichert jede Änderung sofort */
export function PaymentControls(p: Props) {
  const [method, setMethod] = useState<string>(effectiveMethod(p.method, p.paid));
  const info = methodInfo(method);
  const [partnerPaid, setPartnerPaid] = useState(p.partnerPaid);
  const [shared, setShared] = useState(p.shared);
  const [cancelUntil, setCancelUntil] = useState(p.cancelUntil ?? "");
  const [amount, setAmount] = useState(p.amount ?? p.defaultAmount ?? null);
  const [pending, start] = useTransition();

  const save = (fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("trip_id", String(p.tripId));
    fd.set("item_type", p.itemType);
    if (p.itemId != null) fd.set("item_id", String(p.itemId));
    if (p.paymentId) fd.set("payment_id", String(p.paymentId));
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(() => setPayment(fd));
  };

  const share = shared && amount != null ? amount / 2 : 0;
  const daysLeft = cancelUntil ? Math.round((Date.parse(cancelUntil) - Date.parse(p.today)) / 86400000) : null;
  const deadlineCls =
    daysLeft == null
      ? "border-line text-slate-500"
      : daysLeft < 0
        ? "border-line bg-slate-100 text-slate-400"
        : daysLeft <= 14
          ? "border-red-200 bg-red-50 text-red-700"
          : daysLeft <= 30
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-line text-slate-600";

  return (
    <div className={`flex flex-wrap items-center gap-2 transition ${pending ? "opacity-70" : ""}`}>
      {/* Betrag */}
      <label className="flex items-center gap-1 rounded-full border border-line bg-white/70 px-3 py-1.5 text-sm">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={amount ?? ""}
          placeholder="Betrag"
          className="w-20 bg-transparent text-right tabular-nums outline-none"
          onBlur={(e) => {
            const v = e.currentTarget.value === "" ? null : Number(e.currentTarget.value);
            if (v !== amount) {
              setAmount(v);
              save({ amount: e.currentTarget.value });
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <span className="text-slate-400">€</span>
      </label>

      {/* Zahlung: womit bzw. noch offen */}
      <label
        className={`relative flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          info?.paid
            ? "border-sky-700 bg-sky-700 text-white"
            : method === "onsite"
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-clay/40 bg-clay/5 text-clay"
        }`}
        title="Zahlung"
      >
        <span>{info?.icon}</span>
        <span>{info?.paid && method !== "other" ? `Bezahlt · ${info.short}` : info?.short}</span>
        <span className="opacity-60">▾</span>
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.currentTarget.value);
            save({ payment_method: e.currentTarget.value });
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Zahlung"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.icon} {m.label}
            </option>
          ))}
        </select>
      </label>

      {/* Anteil Partner:in */}
      {shared ? (
        <button
          type="button"
          onClick={() => {
            setPartnerPaid(!partnerPaid);
            save({ partner_paid: String(!partnerPaid) });
          }}
          className={`btn border px-3 py-1.5 text-xs ${partnerPaid ? "border-sky-200 bg-sky-50 text-sky-800" : "border-clay/40 bg-clay/5 text-clay hover:border-clay"}`}
          title={`${p.partnerName}s Anteil (die Hälfte)`}
        >
          {partnerPaid ? `✓ ${p.partnerName} hat überwiesen` : `${p.partnerName} schuldet ${share ? eur(share) : "½"}`}
        </button>
      ) : (
        <span className="chip border border-line text-slate-400">Nur ich</span>
      )}

      {/* Stornierbar bis */}
      <label className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${deadlineCls}`}>
        <span className="whitespace-nowrap">
          {daysLeft == null
            ? "Storno bis"
            : daysLeft < 0
              ? "Storno abgelaufen"
              : daysLeft === 0
                ? "Storno heute!"
                : `Storno noch ${daysLeft} T.`}
        </span>
        <input
          type="date"
          value={cancelUntil}
          onChange={(e) => {
            setCancelUntil(e.currentTarget.value);
            save({ cancel_until: e.currentTarget.value });
          }}
          className="bg-transparent text-xs outline-none"
        />
      </label>

      {/* Geteilt umschalten */}
      <button
        type="button"
        onClick={() => {
          setShared(!shared);
          save({ shared: String(!shared) });
        }}
        className="text-[11px] text-slate-400 underline-offset-2 hover:text-ink hover:underline"
      >
        {shared ? "nur für mich" : `mit ${p.partnerName} teilen`}
      </button>
    </div>
  );
}
