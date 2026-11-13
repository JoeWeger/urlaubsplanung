import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createActivity,
  deleteActivity,
  deleteHotel,
  deleteStop,
  refreshHotel,
  setHotelStatus,
  toggleActivity,
  updateActivity,
  updateHotel,
  updateStop,
} from "@/app/actions";
import { getActivities, getHotels, getStop, getStops, getTrip, type Activity, type Hotel } from "@/lib/data";
import {
  addDays,
  fmtDate,
  fmtMoney,
  fmtRange,
  hostOf,
  nightsBetween,
  rating10,
  sourceLabel,
} from "@/lib/format";
import { HotelImport } from "@/components/HotelImport";
import { ConfirmButton, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

type Sort = "price" | "rating" | "added";

const STATUS: Record<string, { label: string; cls: string }> = {
  shortlist: { label: "Auswahl", cls: "bg-slate-100 text-slate-600" },
  favorite: { label: "★ Favorit", cls: "bg-amber-100 text-amber-700" },
  booked: { label: "✓ Gebucht", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Verworfen", cls: "bg-red-50 text-red-500" },
};

export default async function StopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; stopId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id, stopId } = await params;
  const sort = ((await searchParams).sort ?? "price") as Sort;
  const [trip, stop] = await Promise.all([getTrip(Number(id)), getStop(Number(stopId))]);
  if (!trip || !stop || stop.trip_id !== trip.id) notFound();
  const [hotels, activities, allStops] = await Promise.all([
    getHotels(stop.id),
    getActivities(stop.id),
    getStops(trip.id),
  ]);
  const color = trip.color ?? "#0ea5e9";
  const nights = nightsBetween(stop.start_date, stop.end_date);
  const idx = allStops.findIndex((s) => s.id === stop.id);
  const prev = allStops[idx - 1];
  const next = allStops[idx + 1];

  const totalOf = (h: Hotel) => {
    if (h.price_total != null) return h.price_total;
    const n = nightsBetween(h.checkin, h.checkout) ?? nights;
    return h.price_per_night != null && n ? h.price_per_night * n : null;
  };
  const active = hotels.filter((h) => h.status !== "rejected");
  const rejected = hotels.filter((h) => h.status === "rejected");
  const sorted = [...active].sort((a, b) => {
    if (a.status === "booked") return -1;
    if (b.status === "booked") return 1;
    if (sort === "rating") return (rating10(b.rating, b.rating_scale) ?? -1) - (rating10(a.rating, a.rating_scale) ?? -1);
    if (sort === "price") return (totalOf(a) ?? Infinity) - (totalOf(b) ?? Infinity);
    return a.id - b.id;
  });
  const prices = active.map(totalOf).filter((x): x is number => x != null);
  const ratings = active.map((h) => rating10(h.rating, h.rating_scale)).filter((x): x is number => x != null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const bestRating = ratings.length ? Math.max(...ratings) : null;

  // Tage des Stopps für die Aktivitäten-Planung
  const days: string[] = [];
  if (stop.start_date && stop.end_date) {
    for (let d = stop.start_date; d <= stop.end_date && days.length < 60; d = addDays(d, 1)) days.push(d);
  }
  const byDay = new Map<string, Activity[]>();
  for (const a of activities) {
    const k = a.date ?? "";
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const dayKeys = Array.from(new Set([...days, ...byDay.keys()])).sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: color }} />
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <Link href={`/trips/${trip.id}`} className="hover:text-slate-600">← {trip.name}</Link>
            <div className="flex gap-3">
              {prev && <Link href={`/trips/${trip.id}/stops/${prev.id}`} className="hover:text-slate-600">‹ {prev.name}</Link>}
              {next && <Link href={`/trips/${trip.id}/stops/${next.id}`} className="hover:text-slate-600">{next.name} ›</Link>}
            </div>
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            <span className="mr-2 text-slate-300">#{idx + 1}</span>
            {stop.name}
          </h1>
          <p className="text-slate-600">
            {fmtRange(stop.start_date, stop.end_date)}
            {nights ? ` · ${nights} ${nights === 1 ? "Nacht" : "Nächte"}` : ""}
          </p>
          {stop.description && <p className="mt-2 max-w-3xl text-sm whitespace-pre-line text-slate-600">{stop.description}</p>}
          <div className="mt-2 flex gap-2">
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(stop.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost px-2 py-1 text-xs"
            >
              🗺 Karte
            </a>
          </div>
        </div>
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer px-5 py-2.5 text-sm text-slate-500 hover:bg-slate-50">✏️ Stopp bearbeiten</summary>
          <div className="p-5 pt-2">
            <form action={updateStop} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={stop.id} />
              <div className="sm:col-span-2">
                <label className="label">Ort</label>
                <input name="name" defaultValue={stop.name} className="input" />
              </div>
              <div>
                <label className="label">Ankunft</label>
                <input type="date" name="start_date" defaultValue={stop.start_date ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Abreise</label>
                <input type="date" name="end_date" defaultValue={stop.end_date ?? ""} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Kurzbeschreibung</label>
                <textarea name="description" rows={3} defaultValue={stop.description ?? ""} className="input" />
              </div>
              <div>
                <SubmitButton>Speichern</SubmitButton>
              </div>
            </form>
            <form action={deleteStop} className="mt-3">
              <input type="hidden" name="id" value={stop.id} />
              <input type="hidden" name="trip_id" value={trip.id} />
              <ConfirmButton message="Stopp inkl. Hotels und Aktivitäten löschen?">Stopp löschen</ConfirmButton>
            </form>
          </div>
        </details>
      </div>

      {/* Hotels */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Unterkünfte <span className="text-slate-400">({active.length})</span></h2>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-slate-400">Sortieren:</span>
            {(
              [
                ["price", "Preis"],
                ["rating", "Bewertung"],
                ["added", "Hinzugefügt"],
              ] as const
            ).map(([k, l]) => (
              <Link
                key={k}
                href={`?sort=${k}`}
                scroll={false}
                className={`rounded-md px-2 py-1 ${sort === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>

        <HotelImport stopId={stop.id} />

        {sorted.length > 1 && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Unterkunft</th>
                  <th className="px-3 py-2 text-right">Gesamt</th>
                  <th className="px-3 py-2 text-right">/ Nacht</th>
                  <th className="px-3 py-2 text-right">Bewertung</th>
                  <th className="px-3 py-2 text-right">Reviews</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => {
                  const t = totalOf(h);
                  const r = rating10(h.rating, h.rating_scale);
                  return (
                    <tr key={h.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <a href={`#hotel-${h.id}`} className="font-medium hover:text-sky-700">{h.name}</a>
                        <span className={`chip ml-2 ${STATUS[h.status]?.cls}`}>{STATUS[h.status]?.label}</span>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${t != null && t === cheapest ? "font-bold text-emerald-600" : ""}`}>
                        {fmtMoney(t, h.currency)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{fmtMoney(h.price_per_night, h.currency)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r != null && r === bestRating ? "font-bold text-emerald-600" : ""}`}>
                        {r != null ? `${r.toFixed(1)}/10` : "–"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{h.review_count ?? "–"}</td>
                      <td className="px-3 py-2 text-right">
                        {h.url && (
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                            Öffnen ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((h) => (
            <HotelCard
              key={h.id}
              h={h}
              total={totalOf(h)}
              isCheapest={totalOf(h) != null && totalOf(h) === cheapest && active.length > 1}
              isBest={rating10(h.rating, h.rating_scale) === bestRating && bestRating != null && active.length > 1}
              defaultCheckin={stop.start_date}
              defaultCheckout={stop.end_date}
            />
          ))}
        </div>

        {rejected.length > 0 && (
          <details className="card">
            <summary className="btn-ghost w-full justify-start px-4 py-3 text-slate-500">Verworfen ({rejected.length})</summary>
            <ul className="divide-y divide-slate-100 px-4 pb-2 text-sm">
              {rejected.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate text-slate-500 line-through">{h.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <form action={setHotelStatus}>
                      <input type="hidden" name="id" value={h.id} />
                      <input type="hidden" name="status" value="shortlist" />
                      <button className="btn-ghost px-2 py-1 text-xs">Zurückholen</button>
                    </form>
                    <form action={deleteHotel}>
                      <input type="hidden" name="id" value={h.id} />
                      <ConfirmButton className="btn-danger px-2 py-1 text-xs">Löschen</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Aktivitäten */}
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="h2 mb-3">Geplant in {stop.name}</h2>
          {activities.length === 0 && (
            <div className="card p-6 text-center text-sm text-slate-500">Noch nichts geplant – rechts Aktivitäten, Restaurants, Ausflüge eintragen.</div>
          )}
          <div className="space-y-4">
            {dayKeys
              .filter((k) => byDay.has(k))
              .map((k) => (
                <div key={k || "none"}>
                  <h3 className="mb-1.5 text-sm font-semibold text-slate-500">{k ? fmtDate(k) : "Ohne Datum / Ideen"}</h3>
                  <div className="space-y-2">
                    {byDay.get(k)!.map((a) => (
                      <ActivityCard key={a.id} a={a} days={days} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
        <aside>
          <form action={createActivity} className="card sticky top-20 space-y-3 p-4">
            <h3 className="font-semibold">＋ Aktivität / Idee</h3>
            <input type="hidden" name="stop_id" value={stop.id} />
            <ActivityFields days={days} />
            <SubmitButton className="btn-primary w-full">Hinzufügen</SubmitButton>
          </form>
        </aside>
      </section>
    </div>
  );
}

function HotelCard({
  h,
  total,
  isCheapest,
  isBest,
  defaultCheckin,
  defaultCheckout,
}: {
  h: Hotel;
  total: number | null;
  isCheapest: boolean;
  isBest: boolean;
  defaultCheckin: string | null;
  defaultCheckout: string | null;
}) {
  const r10 = rating10(h.rating, h.rating_scale);
  const st = STATUS[h.status] ?? STATUS.shortlist;
  const n = nightsBetween(h.checkin, h.checkout);
  return (
    <article
      id={`hotel-${h.id}`}
      className={`card flex scroll-mt-24 flex-col overflow-hidden ${h.status === "booked" ? "ring-2 ring-emerald-500" : h.status === "favorite" ? "ring-2 ring-amber-400" : ""}`}
    >
      <a href={h.url ?? "#"} target="_blank" rel="noopener noreferrer" className="relative block aspect-[16/9] bg-slate-100">
        {h.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid h-full place-items-center text-4xl text-slate-300">🏨</div>
        )}
        <span className="chip absolute top-2 left-2 bg-white/90 text-slate-700 shadow-sm">{sourceLabel(h.source)}</span>
        <span className={`chip absolute top-2 right-2 shadow-sm ${st.cls}`}>{st.label}</span>
      </a>
      <div className="flex flex-1 flex-col p-4">
        <a href={h.url ?? "#"} target="_blank" rel="noopener noreferrer" className="font-semibold leading-snug hover:text-sky-700">
          {h.name ?? hostOf(h.url)}
        </a>
        {h.address && <p className="mt-0.5 text-xs text-slate-500">{h.address}</p>}

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className={`text-xl font-bold tabular-nums ${isCheapest ? "text-emerald-600" : ""}`}>
              {fmtMoney(total, h.currency)}
            </div>
            <div className="text-xs text-slate-500">
              {h.price_per_night != null ? `${fmtMoney(h.price_per_night, h.currency)} / Nacht` : "Preis fehlt"}
              {n ? ` · ${n} N.` : ""}
            </div>
          </div>
          <div className="text-right">
            {h.rating != null ? (
              <>
                <div
                  className={`inline-block rounded-lg px-2 py-1 text-sm font-bold text-white ${isBest ? "bg-emerald-600" : "bg-sky-800"}`}
                >
                  {h.rating_scale === 5 ? `★ ${h.rating.toFixed(2)}` : h.rating.toFixed(1)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {r10 != null && h.rating_scale === 5 ? `≈ ${r10.toFixed(1)}/10 · ` : ""}
                  {h.review_count != null ? `${h.review_count} Bewertungen` : ""}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">keine Bewertung</div>
            )}
          </div>
        </div>
        {(isCheapest || isBest) && (
          <div className="mt-2 flex gap-1">
            {isCheapest && <span className="chip bg-emerald-50 text-emerald-700">Günstigste</span>}
            {isBest && <span className="chip bg-emerald-50 text-emerald-700">Beste Bewertung</span>}
          </div>
        )}
        {h.notes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs whitespace-pre-line text-amber-900">{h.notes}</p>}
        {h.description && !h.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{h.description}</p>}

        <div className="mt-auto pt-3">
          {h.url && (
            <a href={h.url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
              Zum Angebot auf {sourceLabel(h.source)} ↗
            </a>
          )}
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(["favorite", "booked", "rejected"] as const).map((s) => (
              <form key={s} action={setHotelStatus}>
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="status" value={h.status === s ? "shortlist" : s} />
                <button
                  className={`btn w-full px-1 py-1.5 text-xs ${h.status === s ? STATUS[s].cls : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {s === "favorite" ? "★ Favorit" : s === "booked" ? "✓ Gebucht" : "✕ Weg"}
                </button>
              </form>
            ))}
          </div>
          <details className="mt-2">
            <summary className="btn-ghost w-full px-2 py-1 text-xs">Details bearbeiten</summary>
            <form action={updateHotel} className="mt-2 grid grid-cols-2 gap-2">
              <input type="hidden" name="id" value={h.id} />
              <div className="col-span-2">
                <label className="label">Name</label>
                <input name="name" defaultValue={h.name ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Gesamtpreis</label>
                <input name="price_total" inputMode="decimal" defaultValue={h.price_total ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Preis / Nacht</label>
                <input name="price_per_night" inputMode="decimal" defaultValue={h.price_per_night ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Check-in</label>
                <input type="date" name="checkin" defaultValue={h.checkin ?? defaultCheckin ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Check-out</label>
                <input type="date" name="checkout" defaultValue={h.checkout ?? defaultCheckout ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Bewertung</label>
                <input name="rating" inputMode="decimal" defaultValue={h.rating ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Skala</label>
                <select name="rating_scale" defaultValue={h.rating_scale ?? (h.source === "airbnb" ? 5 : 10)} className="input">
                  <option value="10">von 10</option>
                  <option value="5">von 5</option>
                </select>
              </div>
              <div>
                <label className="label">Anz. Bewertungen</label>
                <input name="review_count" inputMode="numeric" defaultValue={h.review_count ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Währung</label>
                <input name="currency" defaultValue={h.currency ?? "EUR"} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Adresse</label>
                <input name="address" defaultValue={h.address ?? ""} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Link</label>
                <input name="url" defaultValue={h.url ?? ""} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Bild-URL</label>
                <input name="image" defaultValue={h.image ?? ""} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Beschreibung</label>
                <textarea name="description" rows={2} defaultValue={h.description ?? ""} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Eigene Notizen</label>
                <textarea name="notes" rows={2} defaultValue={h.notes ?? ""} placeholder="Pro/Contra, Lage, Frühstück …" className="input" />
              </div>
              <div className="col-span-2">
                <SubmitButton className="btn-primary w-full">Speichern</SubmitButton>
              </div>
            </form>
            <div className="mt-2 flex justify-between">
              <form action={refreshHotel}>
                <input type="hidden" name="id" value={h.id} />
                <SubmitButton className="btn-ghost px-2 py-1 text-xs" pendingText="Lade …">↻ Neu auslesen</SubmitButton>
              </form>
              <form action={deleteHotel}>
                <input type="hidden" name="id" value={h.id} />
                <ConfirmButton className="btn-danger px-2 py-1 text-xs" message="Unterkunft löschen?">Löschen</ConfirmButton>
              </form>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function ActivityFields({ a, days }: { a?: Activity; days: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <label className="label">Titel</label>
        <input name="title" required defaultValue={a?.title} placeholder="z. B. Altstadt & Notre-Dame" className="input" />
      </div>
      <div>
        <label className="label">Tag</label>
        {days.length > 0 ? (
          <select name="date" defaultValue={a?.date ?? ""} className="input">
            <option value="">Ohne Datum</option>
            {days.map((d) => (
              <option key={d} value={d}>{fmtDate(d)}</option>
            ))}
          </select>
        ) : (
          <input type="date" name="date" defaultValue={a?.date ?? ""} className="input" />
        )}
      </div>
      <div>
        <label className="label">Uhrzeit</label>
        <input type="time" name="time" defaultValue={a?.time ?? ""} className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Link</label>
        <input name="link" type="url" defaultValue={a?.link ?? ""} placeholder="https://…" className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Kurzbeschreibung</label>
        <textarea name="description" rows={2} defaultValue={a?.description ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Kosten (€)</label>
        <input name="cost" inputMode="decimal" defaultValue={a?.cost ?? ""} className="input" />
      </div>
    </div>
  );
}

function ActivityCard({ a, days }: { a: Activity; days: string[] }) {
  return (
    <div className={`card p-3 ${a.done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <form action={toggleActivity}>
          <input type="hidden" name="id" value={a.id} />
          <button
            className={`mt-0.5 grid h-5 w-5 cursor-pointer place-items-center rounded border text-xs ${a.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}
            title="Erledigt"
          >
            {a.done ? "✓" : ""}
          </button>
        </form>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className={`font-medium ${a.done ? "line-through" : ""}`}>
              {a.time && <span className="mr-1.5 text-sm text-slate-400">{a.time.slice(0, 5)}</span>}
              {a.title}
            </h4>
            {a.cost != null && <span className="text-sm text-slate-500">{fmtMoney(a.cost)}</span>}
          </div>
          {a.description && <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{a.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {a.link && (
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-700 hover:underline">
                🔗 {hostOf(a.link)} ↗
              </a>
            )}
          </div>
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Bearbeiten</summary>
            <form action={updateActivity} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={a.id} />
              <ActivityFields a={a} days={days} />
              <SubmitButton>Speichern</SubmitButton>
            </form>
            <form action={deleteActivity} className="mt-2">
              <input type="hidden" name="id" value={a.id} />
              <ConfirmButton className="btn-danger px-2 py-1 text-xs" message="Aktivität löschen?">Löschen</ConfirmButton>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
