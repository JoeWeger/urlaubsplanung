import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createActivity,
  markBooked,
  refreshActivity,
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
  tripColor,
} from "@/lib/format";
import { Cover } from "@/components/Cover";
import { CoverImg } from "@/components/CoverImg";
import { HotelImport } from "@/components/HotelImport";
import { ActivityImport } from "@/components/ActivityImport";
import { ConfirmButton, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

type Sort = "price" | "rating" | "added";

const STATUS: Record<string, { label: string; cls: string }> = {
  shortlist: { label: "In Auswahl", cls: "bg-paper/90 text-slate-600" },
  favorite: { label: "★ Favorit", cls: "bg-gold text-white" },
  booked: { label: "✓ Gebucht", cls: "bg-sky-700 text-white" },
  rejected: { label: "Verworfen", cls: "bg-red-50 text-red-600" },
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
  const color = tripColor(trip.color);
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
  const restaurants = activities.filter((a) => a.category === "restaurant");
  const things = activities.filter((a) => a.category !== "restaurant");
  const dayOptions = days.map((d) => ({ value: d, label: fmtDate(d) }));
  const byDay = new Map<string, Activity[]>();
  for (const a of things) {
    const k = a.date ?? "";
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const dayKeys = Array.from(new Set([...days, ...byDay.keys()])).sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );

  const heroImage =
    (active.find((h) => h.status === "booked" && h.image) ?? active.find((h) => h.status === "favorite" && h.image) ?? active.find((h) => h.image))?.image;
  const sortLinks = [
    ["price", "Preis"],
    ["rating", "Bewertung"],
    ["added", "Neueste"],
  ] as const;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link href={`/trips/${trip.id}`} className="btn-ghost -ml-3 px-3 py-1.5 text-xs">← {trip.name}</Link>
          <div className="flex gap-1">
            {prev && <Link href={`/trips/${trip.id}/stops/${prev.id}`} className="btn-outline px-3 py-1.5 text-xs">‹ {prev.name}</Link>}
            {next && <Link href={`/trips/${trip.id}/stops/${next.id}`} className="btn-outline px-3 py-1.5 text-xs">{next.name} ›</Link>}
          </div>
        </div>
        <Cover color={color} image={heroImage} className="min-h-[280px] sm:min-h-[340px]" rounded="rounded-[2rem]">
          <div className="flex min-h-[280px] flex-col justify-end p-6 text-white sm:min-h-[340px] sm:p-10">
            <p className="eyebrow text-white/75">Stopp {idx + 1} von {allStops.length} · {trip.name}</p>
            <h1 className="font-display mt-1 text-5xl leading-none font-light sm:text-7xl">{stop.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-white/90">
              <span>
                {fmtRange(stop.start_date, stop.end_date)}
                {nights ? ` · ${nights} ${nights === 1 ? "Nacht" : "Nächte"}` : ""}
              </span>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(stop.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="chip bg-white/20 text-white backdrop-blur-md hover:bg-white/30"
              >
                Karte ↗
              </a>
            </div>
          </div>
        </Cover>
        {stop.description && (
          <p className="font-display mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed whitespace-pre-line text-slate-600 italic">
            {stop.description}
          </p>
        )}
      </section>

      {/* Unterkünfte */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Schlafen</p>
            <h2 className="h2">
              Unterkünfte <span className="text-slate-400">{active.length}</span>
            </h2>
          </div>
          {active.length > 1 && (
            <div className="flex items-center gap-1 rounded-full border border-line bg-paper p-1 text-sm">
              {sortLinks.map(([k, l]) => (
                <Link
                  key={k}
                  href={`?sort=${k}`}
                  scroll={false}
                  className={`rounded-full px-3 py-1 transition ${sort === k ? "bg-ink text-paper" : "text-slate-600 hover:text-ink"}`}
                >
                  {l}
                </Link>
              ))}
            </div>
          )}
        </div>

        <HotelImport stopId={stop.id} />

        {sorted.length > 1 && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] tracking-widest text-slate-400 uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Vergleich</th>
                  <th className="px-3 py-3 text-right font-semibold">Gesamt</th>
                  <th className="px-3 py-3 text-right font-semibold">/ Nacht</th>
                  <th className="px-3 py-3 text-right font-semibold">Bewertung</th>
                  <th className="px-3 py-3 text-right font-semibold">Reviews</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => {
                  const t = totalOf(h);
                  const r = rating10(h.rating, h.rating_scale);
                  return (
                    <tr key={h.id} className="border-t border-line/70 transition hover:bg-sand/50">
                      <td className="px-5 py-3">
                        <a href={`#hotel-${h.id}`} className="font-medium hover:text-sky-700">{h.name}</a>
                        {h.status !== "shortlist" && <span className={`chip ml-2 ${STATUS[h.status]?.cls}`}>{STATUS[h.status]?.label}</span>}
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums ${t != null && t === cheapest ? "font-semibold text-sky-700" : ""}`}>
                        {fmtMoney(t, h.currency)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500 tabular-nums">{fmtMoney(h.price_per_night, h.currency)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${r != null && r === bestRating ? "font-semibold text-sky-700" : ""}`}>
                        {r != null ? `${r.toFixed(1)}` : "–"}
                        <span className="text-slate-400">{r != null ? " /10" : ""}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500 tabular-nums">{h.review_count ?? "–"}</td>
                      <td className="px-5 py-3 text-right">
                        {h.url && (
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-ink">
                            ↗
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
          <details className="card group">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm text-slate-500 hover:text-ink">
              <span>Verworfen ({rejected.length})</span>
              <span className="transition group-open:rotate-180">⌄</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line px-4 text-sm">
              {rejected.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="truncate text-slate-500 line-through">{h.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <form action={setHotelStatus}>
                      <input type="hidden" name="id" value={h.id} />
                      <input type="hidden" name="status" value="shortlist" />
                      <button className="btn-ghost px-3 py-1 text-xs">Zurückholen</button>
                    </form>
                    <form action={deleteHotel}>
                      <input type="hidden" name="id" value={h.id} />
                      <ConfirmButton className="btn-danger px-3 py-1 text-xs">Löschen</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Aktivitäten */}
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="eyebrow">Erleben</p>
          <h2 className="h2 mb-5">Geplant in {stop.name}</h2>
          {things.length === 0 && (
            <div className="card p-8 text-center text-sm text-slate-500">Noch nichts geplant – Aktivitäten, Restaurants und Ausflüge rechts eintragen.</div>
          )}
          <div className="space-y-8">
            {dayKeys
              .filter((k) => byDay.has(k))
              .map((k) => (
                <div key={k || "none"} className="grid gap-3 sm:grid-cols-[110px_1fr]">
                  <div className="sm:pt-3">
                    {k ? (
                      <>
                        <div className="font-display text-3xl leading-none">{Number(k.slice(8, 10))}.</div>
                        <div className="text-xs tracking-wider text-slate-500 uppercase">{fmtDate(k).split(",")[0]}</div>
                      </>
                    ) : (
                      <div className="font-display text-xl text-slate-500 italic">Ideen</div>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {byDay.get(k)!.map((a) => (
                      <ActivityCard key={a.id} a={a} days={days} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="card space-y-3 p-5">
            <div>
              <p className="eyebrow">Neu</p>
              <h3 className="font-display text-xl">Aktivität oder Idee</h3>
            </div>
            <ActivityImport stopId={stop.id} days={dayOptions} />
          </div>
          <form action={createActivity} className="card space-y-4 p-5">
            <p className="eyebrow">…oder selbst eintragen</p>
            <input type="hidden" name="stop_id" value={stop.id} />
            <ActivityFields days={days} />
            <SubmitButton className="btn-primary w-full">Hinzufügen</SubmitButton>
          </form>
        </aside>
      </section>

      {/* Restaurants */}
      <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="eyebrow">Essen &amp; Trinken</p>
          <h2 className="h2 mb-5">
            Restaurants <span className="text-slate-400">{restaurants.length || ""}</span>
          </h2>
          {restaurants.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">
              Noch keine Restaurants – rechts per Link (TheFork, OpenTable, Tripadvisor, Website) oder von Hand eintragen.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...restaurants]
                .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? ""))
                .map((r) => (
                  <RestaurantCard key={r.id} r={r} days={days} />
                ))}
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <div className="card space-y-3 p-5">
            <div>
              <p className="eyebrow">Neu</p>
              <h3 className="font-display text-xl">Restaurant merken</h3>
            </div>
            <ActivityImport stopId={stop.id} days={dayOptions} category="restaurant" />
          </div>
          <form action={createActivity} className="card space-y-4 p-5">
            <p className="eyebrow">…oder selbst eintragen</p>
            <input type="hidden" name="stop_id" value={stop.id} />
            <input type="hidden" name="category" value="restaurant" />
            <RestaurantFields days={days} />
            <SubmitButton className="btn-primary w-full">Hinzufügen</SubmitButton>
          </form>
        </aside>
      </section>

      <details className="card group">
        <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium text-slate-600 hover:text-ink">
          <span>Stopp bearbeiten</span>
          <span className="transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-line p-5">
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
              <SubmitButton className="btn-primary">Speichern</SubmitButton>
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
      className={`card card-hover group flex scroll-mt-24 flex-col overflow-hidden ${h.status === "booked" ? "ring-2 ring-sky-700 ring-offset-2 ring-offset-sand" : h.status === "favorite" ? "ring-2 ring-gold ring-offset-2 ring-offset-sand" : ""}`}
    >
      <a href={h.url ?? "#"} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] overflow-hidden bg-sand-deep">
        <div className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
            <path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6" />
          </svg>
        </div>
        {h.image && <CoverImg src={h.image} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
        <div className="absolute inset-x-0 top-0 flex justify-between p-3">
          <span className="chip bg-paper/90 text-slate-700 backdrop-blur">{sourceLabel(h.source)}</span>
          {h.status !== "shortlist" && <span className={`chip shadow-sm ${st.cls}`}>{st.label}</span>}
        </div>
        {h.rating != null && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-paper/95 py-1 pr-3 pl-1 text-xs shadow-sm backdrop-blur">
            <span className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-semibold text-white ${isBest ? "bg-sky-700" : "bg-ink"}`}>
              {h.rating_scale === 5 ? h.rating.toFixed(2).replace(".", ",") : h.rating.toFixed(1).replace(".", ",")}
            </span>
            <span className="text-slate-600">
              {h.rating_scale === 5 ? "★ von 5" : "von 10"}
              {h.review_count != null ? ` · ${h.review_count}` : ""}
            </span>
          </div>
        )}
      </a>
      <div className="flex flex-1 flex-col p-5">
        <a href={h.url ?? "#"} target="_blank" rel="noopener noreferrer" className="font-display text-xl leading-snug hover:text-sky-700">
          {h.name ?? hostOf(h.url)}
        </a>
        {h.address && <p className="mt-0.5 text-xs text-slate-500">{h.address}</p>}

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className={`font-display text-3xl tabular-nums ${isCheapest ? "text-sky-700" : ""}`}>
              {fmtMoney(total, h.currency)}
            </div>
            <div className="text-xs text-slate-500">
              {h.price_per_night != null ? `${fmtMoney(h.price_per_night, h.currency)} / Nacht` : "Preis fehlt"}
              {n ? ` · ${n} N.` : ""}
            </div>
            {h.orig_price != null && h.orig_currency && (
              <div className="text-[11px] text-slate-400" title="Booking-Preis in Landeswährung, mit aktuellem Kurs umgerechnet">
                ≈ umgerechnet aus {fmtMoney(h.orig_price, h.orig_currency)}
              </div>
            )}
          </div>
          <div className="text-right text-[11px] text-slate-400">
            {h.rating == null ? "noch keine Bewertung" : r10 != null && h.rating_scale === 5 ? `≈ ${r10.toFixed(1)}/10` : ""}
          </div>
        </div>
        {(isCheapest || isBest) && (
          <div className="mt-2 flex gap-1">
            {isCheapest && <span className="chip bg-sky-50 text-sky-800">Günstigste</span>}
            {isBest && <span className="chip bg-sky-50 text-sky-800">Beste Bewertung</span>}
          </div>
        )}
        {h.notes && <p className="font-display mt-3 rounded-2xl bg-sand p-3 text-sm whitespace-pre-line text-slate-700 italic">{h.notes}</p>}
        {h.description && !h.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{h.description}</p>}

        <div className="mt-auto pt-4">
          {h.url && (
            <a href={h.url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full py-2.5">
              Zum Angebot auf {sourceLabel(h.source)} ↗
            </a>
          )}
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(["favorite", "booked", "rejected"] as const).map((s) => (
              <form key={s} action={setHotelStatus}>
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="status" value={h.status === s ? "shortlist" : s} />
                <button
                  className={`btn w-full px-1 py-1.5 text-xs ${h.status === s ? STATUS[s].cls : "border border-line text-slate-600 hover:border-slate-300 hover:text-ink"}`}
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
  const ratingTxt =
    a.rating != null ? (a.rating_scale === 5 || a.rating <= 5 ? a.rating.toFixed(1) : a.rating.toFixed(1)).replace(".", ",") : null;
  return (
    <div className={`card overflow-hidden transition ${a.done ? "opacity-55" : ""}`}>
      <div className="flex">
        {a.image && (
          <a href={a.link ?? "#"} target="_blank" rel="noopener noreferrer" className="relative hidden w-36 shrink-0 bg-sand-deep sm:block">
            <CoverImg src={a.image} className="absolute inset-0 h-full w-full object-cover" />
          </a>
        )}
        <div className="flex min-w-0 flex-1 items-start gap-3 p-4">
          <form action={toggleActivity}>
            <input type="hidden" name="id" value={a.id} />
            <button
              className={`mt-0.5 grid h-6 w-6 cursor-pointer place-items-center rounded-full border-2 text-xs transition ${a.done ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 hover:border-sky-500"}`}
              title="Erledigt"
            >
              {a.done ? "✓" : ""}
            </button>
          </form>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 className={`font-display text-lg leading-snug ${a.done ? "line-through" : ""}`}>
                {a.time && <span className="mr-2 font-sans text-sm text-sky-700 tabular-nums">{a.time.slice(0, 5)}</span>}
                {a.title}
              </h4>
              {a.cost != null && (
                <span className="shrink-0 text-right">
                  <span className="font-display text-lg">{fmtMoney(a.cost)}</span>
                  {a.source && a.source !== "manual" && <span className="block text-[10px] text-slate-400">ab, pro Person</span>}
                </span>
              )}
            </div>
            {(ratingTxt || a.duration || a.source || a.booked) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {ratingTxt && (
                  <span className="chip bg-ink text-paper">
                    ★ {ratingTxt}
                    {a.review_count != null && <span className="font-normal text-paper/70">· {a.review_count.toLocaleString("de-DE")}</span>}
                  </span>
                )}
                {a.booked && <span className="chip bg-sky-700 text-white">✓ Gebucht</span>}
                {a.duration && <span className="chip bg-sand-deep text-slate-700">⏱ {a.duration}</span>}
                {a.source && sourceLabel(a.source) !== a.source && <span className="chip border border-line text-slate-500">{sourceLabel(a.source)}</span>}
              </div>
            )}
            {a.description && <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-line text-slate-600">{a.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {a.link && (
                <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sky-700 hover:underline">
                  {a.source && sourceLabel(a.source) !== a.source ? `Auf ${sourceLabel(a.source)} ansehen` : hostOf(a.link)} ↗
                </a>
              )}
              <details className="w-full">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Bearbeiten</summary>
                <form action={updateActivity} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={a.id} />
                  <ActivityFields a={a} days={days} />
                  <SubmitButton className="btn-primary">Speichern</SubmitButton>
                </form>
                <div className="mt-2 flex flex-wrap justify-between gap-2">
                  <form action={markBooked}>
                    <input type="hidden" name="item_type" value="activity" />
                    <input type="hidden" name="item_id" value={a.id} />
                    <SubmitButton className="btn-outline px-3 py-1 text-xs" pendingText="…">
                      {a.booked ? "Nicht gebucht" : "✓ Als gebucht markieren"}
                    </SubmitButton>
                  </form>
                  {a.link && (
                    <form action={refreshActivity}>
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton className="btn-ghost px-2 py-1 text-xs" pendingText="Lade …">↻ Neu auslesen</SubmitButton>
                    </form>
                  )}
                  <form action={deleteActivity}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmButton className="btn-danger px-2 py-1 text-xs" message="Aktivität löschen?">Löschen</ConfirmButton>
                  </form>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRICE_LEVELS = ["€", "€€", "€€€", "€€€€"];

function RestaurantFields({ r, days }: { r?: Activity; days: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <label className="label">Name</label>
        <input name="title" required defaultValue={r?.title} placeholder="z. B. Joe Beef" className="input" />
      </div>
      <div>
        <label className="label">Küche</label>
        <input name="cuisine" defaultValue={r?.cuisine ?? ""} placeholder="Französisch, Bistro …" className="input" />
      </div>
      <div>
        <label className="label">Preisniveau</label>
        <select name="price_level" defaultValue={r?.price_level ?? ""} className="input">
          <option value="">–</option>
          {PRICE_LEVELS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Adresse</label>
        <input name="address" defaultValue={r?.address ?? ""} placeholder="2491 Rue Notre-Dame O, Montréal" className="input" />
      </div>
      <div>
        <label className="label">Tag (Reservierung)</label>
        {days.length > 0 ? (
          <select name="date" defaultValue={r?.date ?? ""} className="input">
            <option value="">Offen</option>
            {days.map((d) => (
              <option key={d} value={d}>{fmtDate(d)}</option>
            ))}
          </select>
        ) : (
          <input type="date" name="date" defaultValue={r?.date ?? ""} className="input" />
        )}
      </div>
      <div>
        <label className="label">Uhrzeit</label>
        <input type="time" name="time" defaultValue={r?.time ?? ""} className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Link</label>
        <input name="link" type="url" defaultValue={r?.link ?? ""} placeholder="https://…" className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Notiz</label>
        <textarea name="description" rows={2} defaultValue={r?.description ?? ""} placeholder="Empfehlung, Gericht probieren …" className="input" />
      </div>
      <input type="hidden" name="cost" value={r?.cost ?? ""} />
      <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="reserved" defaultChecked={r?.reserved ?? false} className="h-4 w-4 accent-[#2e6553]" />
        Tisch reserviert
      </label>
    </div>
  );
}

function RestaurantCard({ r, days }: { r: Activity; days: string[] }) {
  const ratingTxt = r.rating != null ? r.rating.toFixed(1).replace(".", ",") : null;
  const maps = `https://www.google.com/maps/search/${encodeURIComponent([r.title, r.address].filter(Boolean).join(", "))}`;
  return (
    <article className={`card card-hover group flex flex-col overflow-hidden ${r.done ? "opacity-55" : ""}`}>
      <div className="relative aspect-[16/9] bg-sand-deep">
        <div className="absolute inset-0 grid place-items-center text-4xl text-slate-300">🍽</div>
        {r.image && <CoverImg src={r.image} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
        <div className="absolute inset-x-0 top-0 flex justify-between gap-2 p-3">
          {r.reserved ? (
            <span className="chip bg-sky-700 text-white">✓ Reserviert</span>
          ) : (
            <span className="chip bg-paper/90 text-slate-600">Gemerkt</span>
          )}
          {ratingTxt && (
            <span className="chip bg-paper/95 text-ink">
              ★ {ratingTxt}
              {r.review_count != null && <span className="text-slate-500">· {r.review_count.toLocaleString("de-DE")}</span>}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`font-display text-xl leading-snug ${r.done ? "line-through" : ""}`}>{r.title}</h4>
          {r.price_level && <span className="shrink-0 text-sm font-medium tracking-wider text-slate-500">{r.price_level}</span>}
        </div>
        {r.cuisine && <p className="text-sm text-slate-500">{r.cuisine}</p>}
        {(r.date || r.time) && (
          <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
            🕖 {r.date ? fmtDate(r.date) : ""}
            {r.time ? ` · ${r.time.slice(0, 5)} Uhr` : ""}
          </p>
        )}
        {r.description && <p className="font-display mt-2 line-clamp-3 text-sm text-slate-600 italic">{r.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs">
          <a href={maps} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:underline">
            📍 {r.address ? r.address.split(",")[0] : "Karte"} ↗
          </a>
          {r.link && (
            <a href={r.link} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 hover:underline">
              {r.source && sourceLabel(r.source) !== r.source ? sourceLabel(r.source) : "Website"} ↗
            </a>
          )}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Bearbeiten</summary>
          <form action={updateActivity} className="mt-2 space-y-2">
            <input type="hidden" name="id" value={r.id} />
            <RestaurantFields r={r} days={days} />
            <SubmitButton className="btn-primary">Speichern</SubmitButton>
          </form>
          <div className="mt-2 flex justify-between">
            <form action={toggleActivity}>
              <input type="hidden" name="id" value={r.id} />
              <button className="btn-ghost px-2 py-1 text-xs">{r.done ? "Nicht besucht" : "✓ Besucht"}</button>
            </form>
            <form action={deleteActivity}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmButton className="btn-danger px-2 py-1 text-xs" message="Restaurant löschen?">Löschen</ConfirmButton>
            </form>
          </div>
        </details>
      </div>
    </article>
  );
}
