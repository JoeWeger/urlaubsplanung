import Link from "next/link";
import { notFound } from "next/navigation";
import { createExpense, deleteExpense, markBooked, setPartnerName } from "@/app/actions";
import {
  getActivitiesForTrip,
  getCars,
  getFlights,
  getHotelsForTrip,
  getPayments,
  getStops,
  getTrip,
  type Payment,
} from "@/lib/data";
import { fmtMoneyExact as fmtMoney, fmtRange, fmtShort, nightsBetween, toISODate, tripColor } from "@/lib/format";
import { PaymentControls } from "@/components/PaymentControls";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { FIN_GRID, PAYMENT_METHODS, effectiveMethod, methodInfo } from "@/lib/payment-methods";

export const dynamic = "force-dynamic";

type Item = {
  key: string;
  type: "flight" | "hotel" | "car" | "activity" | "custom";
  itemId: number | null;
  icon: string;
  title: string;
  sub: string;
  defaultAmount: number | null;
  payment?: Payment;
};

const GROUPS: { type: Item["type"]; label: string }[] = [
  { type: "flight", label: "Flüge" },
  { type: "hotel", label: "Unterkünfte" },
  { type: "car", label: "Mietwagen" },
  { type: "activity", label: "Ausflüge & Tickets" },
  { type: "custom", label: "Sonstiges" },
];

export default async function FinanzenPage({ params }: { params: Promise<{ id: string }> }) {
  const tripId = Number((await params).id);
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  const [stops, flights, hotels, cars, activities, payments] = await Promise.all([
    getStops(tripId),
    getFlights(tripId),
    getHotelsForTrip(tripId),
    getCars(tripId),
    getActivitiesForTrip(tripId),
    getPayments(tripId),
  ]);
  const partner = trip.partner_name?.trim() || "Lara";
  const today = toISODate(new Date());
  const pay = new Map(payments.filter((p) => p.item_id != null).map((p) => [`${p.item_type}:${p.item_id}`, p]));
  const stopName = new Map(stops.map((s) => [s.id, s]));

  const hotelTotal = (h: (typeof hotels)[number]) => {
    if (h.price_total != null) return h.price_total;
    const st = stopName.get(h.stop_id);
    const n = nightsBetween(h.checkin, h.checkout) ?? nightsBetween(st?.start_date, st?.end_date);
    return h.price_per_night != null && n ? Math.round(h.price_per_night * n) : null;
  };

  const items: Item[] = [
    ...flights.map<Item>((f) => ({
      key: `flight:${f.id}`,
      type: "flight",
      itemId: f.id,
      icon: "✈",
      title: `${f.from_airport ?? "?"} → ${f.to_airport ?? "?"}`,
      sub: [f.airline, f.flight_no, f.depart_at ? fmtShort(f.depart_at.slice(0, 10)) : null].filter(Boolean).join(" · "),
      defaultAmount: f.price,
    })),
    ...hotels
      .filter((h) => h.status === "booked")
      .map<Item>((h) => {
        const st = stopName.get(h.stop_id);
        return {
          key: `hotel:${h.id}`,
          type: "hotel",
          itemId: h.id,
          icon: "🏨",
          title: h.name ?? "Unterkunft",
          sub: [st?.name, fmtRange(h.checkin ?? st?.start_date, h.checkout ?? st?.end_date)].filter(Boolean).join(" · "),
          defaultAmount: hotelTotal(h),
        };
      }),
    ...cars
      .filter((c) => c.booked)
      .map<Item>((c) => ({
        key: `car:${c.id}`,
        type: "car",
        itemId: c.id,
        icon: "🚗",
        title: [c.company, c.car_type].filter(Boolean).join(" · ") || "Mietwagen",
        sub: [c.pickup_place, c.pickup_at ? fmtShort(c.pickup_at.slice(0, 10)) : null].filter(Boolean).join(" · "),
        defaultAmount: c.price,
      })),
    ...activities
      .filter((a) => a.booked)
      .map<Item>((a) => ({
        key: `activity:${a.id}`,
        type: "activity",
        itemId: a.id,
        icon: a.category === "restaurant" ? "🍽" : "🎟",
        title: a.title,
        sub: [stopName.get(a.stop_id)?.name, a.date ? fmtShort(a.date) : null].filter(Boolean).join(" · "),
        defaultAmount: a.cost,
      })),
    ...payments
      .filter((p) => p.item_type === "custom")
      .map<Item>((p) => ({
        key: `custom:${p.id}`,
        type: "custom",
        itemId: null,
        icon: "🧾",
        title: p.title ?? "Sonstiges",
        sub: p.note ?? "",
        defaultAmount: null,
        payment: p,
      })),
  ].map((it) => (it.type === "custom" ? it : { ...it, payment: pay.get(it.key) }));

  // Summen
  const amountOf = (it: Item) => it.payment?.amount ?? it.defaultAmount ?? 0;
  const isShared = (it: Item) => it.payment?.shared ?? true;
  const total = items.reduce((a, it) => a + amountOf(it), 0);
  const methodOf = (it: Item) => effectiveMethod(it.payment?.payment_method, it.payment?.paid);
  const byMethod = new Map<string, number>();
  for (const it of items) byMethod.set(methodOf(it), (byMethod.get(methodOf(it)) ?? 0) + amountOf(it));
  const paid = items.filter((it) => methodInfo(methodOf(it))?.paid).reduce((a, it) => a + amountOf(it), 0);
  const breakdown = (paidOnes: boolean) =>
    PAYMENT_METHODS.filter((m) => m.paid === paidOnes && (byMethod.get(m.value) ?? 0) > 0)
      .map((m) => `${m.value === "other" ? "anders bezahlt" : m.short} ${fmtMoney(byMethod.get(m.value))}`)
      .join(" · ");
  const isJoint = (it: Item) => !!methodInfo(effectiveMethod(it.payment?.payment_method, it.payment?.paid))?.joint;
  const partnerShare = items.filter(isShared).reduce((a, it) => a + amountOf(it) / 2, 0);
  // Gemeinschaftskonto: Anteil automatisch beglichen; sonst zählt "hat überwiesen"
  const jointCovered = items.filter((it) => isShared(it) && isJoint(it)).reduce((a, it) => a + amountOf(it) / 2, 0);
  const partnerPaid = items
    .filter((it) => isShared(it) && !isJoint(it) && it.payment?.partner_paid)
    .reduce((a, it) => a + amountOf(it) / 2, 0);
  const partnerOwes = partnerShare - partnerPaid - jointCovered;
  const settledNote = [
    partnerPaid > 0 ? `${fmtMoney(partnerPaid)} überwiesen` : null,
    jointCovered > 0 ? `${fmtMoney(jointCovered)} über Gemeinschaftskonto` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const deadlines = items
    .filter((it) => it.payment?.cancel_until && it.payment.cancel_until >= today)
    .sort((a, b) => a.payment!.cancel_until!.localeCompare(b.payment!.cancel_until!));
  const missingAmount = items.filter((it) => it.payment?.amount == null && it.defaultAmount == null);

  // Vorschläge: Favoriten / Angebote noch nicht als gebucht markiert
  const suggestions = [
    ...hotels
      .filter((h) => h.status === "favorite")
      .map((h) => ({ type: "hotel", id: h.id, icon: "🏨", title: h.name ?? "Unterkunft", sub: stopName.get(h.stop_id)?.name ?? "", amount: hotelTotal(h) })),
    ...cars
      .filter((c) => !c.booked)
      .map((c) => ({ type: "car", id: c.id, icon: "🚗", title: [c.company, c.car_type].filter(Boolean).join(" · ") || "Mietwagen", sub: "Angebot", amount: c.price })),
    ...activities
      .filter((a) => !a.booked && a.category !== "restaurant" && a.cost != null)
      .map((a) => ({ type: "activity", id: a.id, icon: "🎟", title: a.title, sub: stopName.get(a.stop_id)?.name ?? "", amount: a.cost })),
  ];

  const color = tripColor(trip.color);

  return (
    <div className="space-y-10">
      <section>
        <Link href={`/trips/${trip.id}`} className="btn-ghost -ml-3 mb-3 px-3 py-1.5 text-xs">← {trip.name}</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow" style={{ color }}>{trip.name}</p>
            <h1 className="font-display text-5xl font-light">Finanzen</h1>
            <p className="mt-1 text-slate-500">Alles, was gebucht ist – bezahlt, stornierbar, geteilt.</p>
          </div>
          <form action={setPartnerName} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pr-1 pl-4 text-sm">
            <input type="hidden" name="trip_id" value={trip.id} />
            <span className="text-slate-500">Geteilt mit</span>
            <input name="partner_name" defaultValue={partner} className="w-24 bg-transparent font-medium outline-none" />
            <SubmitButton className="btn-primary px-3 py-1 text-xs">OK</SubmitButton>
          </form>
        </div>
      </section>

      {/* Übersicht */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Gesamtkosten" value={fmtMoney(total)} note={`${items.length} Posten`} strong />
        <Summary
          label="Bezahlt"
          value={fmtMoney(paid)}
          note={[breakdown(true), total - paid > 0 ? `offen: ${breakdown(false)}` : "alles bezahlt ✓"].filter(Boolean).join("\n")}
          bar={total ? paid / total : 0}
        />
        <Summary label={`Anteil ${partner}`} value={fmtMoney(partnerShare)} note="die Hälfte aller geteilten Posten" />
        <Summary
          label={`${partner} schuldet dir`}
          value={fmtMoney(Math.max(0, partnerOwes))}
          note={partnerOwes > 0.005 ? settledNote || "noch nichts überwiesen" : "alles ausgeglichen ✓"}
          accent={partnerOwes > 0.005}
        />
      </section>

      {/* Stornofristen */}
      {deadlines.length > 0 && (
        <section className="card p-5">
          <p className="eyebrow">Fristen</p>
          <h2 className="h2 mb-3">Kostenlos stornierbar bis</h2>
          <ul className="divide-y divide-line">
            {deadlines.map((it) => {
              const d = it.payment!.cancel_until!;
              const left = nightsBetween(today, d) ?? 0;
              return (
                <li key={it.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2">{it.icon}</span>
                    {it.title}
                  </span>
                  <span
                    className={`chip shrink-0 ${left <= 14 ? "bg-red-50 text-red-700" : left <= 30 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {fmtShort(d)} · {left === 0 ? "heute" : `noch ${left} Tage`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Posten */}
      <section className="space-y-8">
        {items.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-500">
            Noch nichts gebucht. Flüge erscheinen automatisch, Hotels sobald du sie auf „Gebucht“ setzt – oder unten übernehmen.
          </div>
        )}
        {items.length > 0 && (
          <div className={`hidden gap-3 px-4 text-[10px] font-semibold tracking-widest text-slate-400 uppercase lg:grid ${FIN_GRID}`}>
            <span>Posten</span>
            <span className="text-right">Betrag</span>
            <span>Zahlung</span>
            <span>{partner}</span>
            <span>Storno bis</span>
            <span />
          </div>
        )}
        {GROUPS.map((g) => {
          const list = items.filter((it) => it.type === g.type);
          if (!list.length) return null;
          const sum = list.reduce((a, it) => a + amountOf(it), 0);
          const owes = list
            .filter((it) => isShared(it) && !isJoint(it) && !it.payment?.partner_paid)
            .reduce((a, it) => a + amountOf(it) / 2, 0);
          return (
            <div key={g.type}>
              <h2 className="h2 mb-3">{g.label}</h2>
              <div className="space-y-2">
                {list.map((it) => (
                  <div key={it.key} className={`card grid gap-3 p-3 pl-4 lg:items-center ${FIN_GRID}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand-deep">{it.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium" title={it.title}>{it.title}</div>
                        {it.sub && <div className="truncate text-xs text-slate-500">{it.sub}</div>}
                      </div>
                      {it.type === "custom" && it.payment && (
                        <form action={deleteExpense}>
                          <input type="hidden" name="id" value={it.payment.id} />
                          <input type="hidden" name="trip_id" value={trip.id} />
                          <ConfirmButton className="cursor-pointer px-1 text-xs text-slate-300 hover:text-red-600" message="Posten löschen?">✕</ConfirmButton>
                        </form>
                      )}
                    </div>
                    <PaymentControls
                      tripId={trip.id}
                      itemType={it.type}
                      itemId={it.itemId}
                      paymentId={it.payment?.id ?? null}
                      paid={it.payment?.paid ?? false}
                      method={it.payment?.payment_method ?? null}
                      partnerPaid={it.payment?.partner_paid ?? false}
                      shared={it.payment?.shared ?? true}
                      cancelUntil={it.payment?.cancel_until ?? null}
                      amount={it.payment?.amount ?? null}
                      defaultAmount={it.defaultAmount}
                      partnerName={partner}
                      today={today}
                    />
                  </div>
                ))}
                {/* Summenzeile der Gruppe */}
                <div className={`flex flex-wrap items-baseline justify-between gap-x-3 px-4 pt-1 text-sm lg:grid lg:items-center ${FIN_GRID}`}>
                  <span className="text-slate-500">Summe {g.label}</span>
                  <span className="font-display text-right text-lg tabular-nums">{fmtMoney(sum)}</span>
                  <span className="hidden lg:block" />
                  <span className={`w-full text-right tabular-nums lg:w-auto lg:px-3 lg:text-left ${owes > 0.005 ? "text-clay" : "text-slate-400"}`}>
                    <span className="lg:hidden">{partner} offen: </span>
                    {owes > 0.005 ? fmtMoney(owes) : "✓"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {items.length > 0 && (
          <div className={`card grid gap-3 border-ink/20 bg-sand-deep/40 p-4 lg:items-center ${FIN_GRID}`}>
            <span className="font-display text-xl">Gesamt</span>
            <span className="font-display text-right text-xl tabular-nums">{fmtMoney(total)}</span>
            <span className="text-xs text-slate-500">bezahlt {fmtMoney(paid)}</span>
            <span className="lg:col-span-3">
              <span className={`font-display text-xl tabular-nums ${partnerOwes > 0.005 ? "text-clay" : "text-sky-700"}`}>
                {partnerOwes > 0.005 ? `${partner} schuldet dir ${fmtMoney(partnerOwes)}` : `${partner}: alles ausgeglichen ✓`}
              </span>
              {settledNote && <span className="ml-2 text-xs text-slate-500">({settledNote})</span>}
            </span>
          </div>
        )}
        {missingAmount.length > 0 && (
          <p className="text-xs text-clay">
            ⚠ Bei {missingAmount.length} {missingAmount.length === 1 ? "Posten fehlt" : "Posten fehlen"} der Betrag – direkt im Feld eintragen.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {/* Eigener Posten */}
        <form action={createExpense} className="card space-y-3 p-5">
          <p className="eyebrow">Neu</p>
          <h3 className="font-display text-xl">Weiteren Posten hinzufügen</h3>
          <input type="hidden" name="trip_id" value={trip.id} />
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="label">Wofür</label>
              <input name="title" required placeholder="Reiseversicherung, eTA Kanada, Parken …" className="input" />
            </div>
            <div>
              <label className="label">Betrag (€)</label>
              <input name="amount" inputMode="decimal" className="input" />
            </div>
            <div>
              <label className="label">Stornierbar bis</label>
              <input type="date" name="cancel_until" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Zahlung</label>
            <select name="payment_method" defaultValue="open" className="input">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.icon} {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="mine_only" className="h-4 w-4 accent-[#2e6553]" /> Nur für mich (nicht teilen)
            </label>
          </div>
          <SubmitButton className="btn-primary w-full">Hinzufügen</SubmitButton>
        </form>

        {/* Vorschläge */}
        <div className="card p-5">
          <p className="eyebrow">Noch nicht gebucht</p>
          <h3 className="font-display mb-3 text-xl">Favoriten &amp; Angebote</h3>
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500">Keine offenen Favoriten oder Angebote.</p>
          ) : (
            <ul className="divide-y divide-line">
              {suggestions.map((sg) => (
                <li key={`${sg.type}:${sg.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="mr-2">{sg.icon}</span>
                    <span className="font-medium">{sg.title}</span>
                    {sg.sub && <span className="text-slate-400"> · {sg.sub}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {sg.amount != null && <span className="text-slate-500 tabular-nums">{fmtMoney(sg.amount)}</span>}
                    <form action={markBooked}>
                      <input type="hidden" name="item_type" value={sg.type} />
                      <input type="hidden" name="item_id" value={sg.id} />
                      <SubmitButton className="btn-outline px-3 py-1 text-xs" pendingText="…">Gebucht ✓</SubmitButton>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  note,
  strong = false,
  accent = false,
  bar,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  accent?: boolean;
  bar?: number;
}) {
  return (
    <div className={`card p-5 ${accent ? "border-clay/40 bg-clay/5" : ""}`}>
      <div className="text-[11px] tracking-wider text-slate-500 uppercase">{label}</div>
      <div className={`font-display mt-1 tabular-nums ${strong ? "text-4xl" : "text-3xl"} ${accent ? "text-clay" : ""}`}>{value}</div>
      {bar != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-deep">
          <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, bar * 100)}%` }} />
        </div>
      )}
      {note && <div className="mt-1.5 text-xs whitespace-pre-line text-slate-500">{note}</div>}
    </div>
  );
}
