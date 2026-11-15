import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCar,
  createFlight,
  deleteCar,
  updateCar,
  uploadCarFiles,
  createStop,
  deleteFlight,
  deleteFlightFile,
  uploadFlightFiles,
  deleteTrip,
  updateFlight,
  updateTrip,
} from "@/app/actions";
import {
  getActivitiesForTrip,
  getCarFiles,
  getCars,
  getFlightFiles,
  getFlights,
  getHotelsForTrip,
  getStopCovers,
  getStops,
  getTrip,
  type Car,
  type Flight,
  type FlightFile,
  type Hotel,
} from "@/lib/data";
import { addDays, fmtMoney, fmtRange, fmtShort, nightsBetween, toISODate, tripColor } from "@/lib/format";
import { Month, monthsBetween, type CalEvent } from "@/components/Calendar";
import { TripFields } from "@/components/TripForm";
import { Cover } from "@/components/Cover";
import { AutoUpload, ConfirmButton, SubmitButton } from "@/components/ui";
import { findGaps, type Gap } from "@/lib/gaps";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const tripId = Number((await params).id);
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  const [stops, flights, hotels, activities, files, stopCovers, cars, carFiles] = await Promise.all([
    getStops(tripId),
    getFlights(tripId),
    getHotelsForTrip(tripId),
    getActivitiesForTrip(tripId),
    getFlightFiles(tripId),
    getStopCovers(tripId),
    getCars(tripId),
    getCarFiles(tripId),
  ]);
  const gaps = findGaps(trip.start_date, trip.end_date, stops);
  const openNights = gaps.reduce((a, g) => a + g.nights, 0);
  type RouteItem = { kind: "stop"; key: string; idx: number } | { kind: "gap"; key: string; gap: Gap };
  const route: RouteItem[] = [
    ...stops.map((s, idx) => ({ kind: "stop" as const, key: s.start_date ?? "9999", idx })),
    ...gaps.map((gap) => ({ kind: "gap" as const, key: gap.start, gap })),
  ].sort((a, b) => a.key.localeCompare(b.key) || (a.kind === "gap" ? -1 : 1));
  const color = tripColor(trip.color);
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const today = toISODate(new Date());
  const daysUntil = trip.start_date && trip.start_date > today ? nightsBetween(today, trip.start_date) : null;
  const plannedNights = nights ? nights - openNights : null;

  // Budget
  const flightCost = flights.reduce((a, f) => a + (f.price ?? 0), 0);
  // Pro Stopp: gebuchtes Hotel, sonst Favorit (bei mehreren der günstigste)
  const hotelTotal = (h: Hotel) => {
    if (h.price_total != null) return h.price_total;
    const st = stops.find((x) => x.id === h.stop_id);
    const n = nightsBetween(h.checkin, h.checkout) ?? nightsBetween(st?.start_date, st?.end_date);
    return h.price_per_night != null && n ? Math.round(h.price_per_night * n) : null;
  };
  const chosenFor = (stopId: number) => {
    const hs = hotels.filter((h) => h.stop_id === stopId);
    const b = hs.find((h) => h.status === "booked");
    if (b) return { hotel: b, booked: true, price: hotelTotal(b) };
    const favs = hs
      .filter((h) => h.status === "favorite")
      .sort((a, z) => (hotelTotal(a) ?? Infinity) - (hotelTotal(z) ?? Infinity));
    return favs[0] ? { hotel: favs[0], booked: false, price: hotelTotal(favs[0]) } : null;
  };
  const chosen = stops.map((s) => chosenFor(s.id)).filter((c): c is NonNullable<typeof c> => c != null);
  const bookedCost = chosen.filter((c) => c.booked).reduce((a, c) => a + (c.price ?? 0), 0);
  const favCost = chosen.filter((c) => !c.booked).reduce((a, c) => a + (c.price ?? 0), 0);
  const hotelCost = bookedCost + favCost;
  const actCost = activities.reduce((a, x) => a + (x.cost ?? 0), 0);
  const carCost = cars.reduce((a, c) => a + (c.price ?? 0), 0);
  const total = flightCost + hotelCost + actCost + carCost;

  // Kalender
  const events: CalEvent[] = [
    ...stops
      .filter((s) => s.start_date)
      .map<CalEvent>((s) => ({
        start: s.start_date!,
        end: s.end_date && s.end_date > s.start_date! ? addDays(s.end_date, -1) : s.start_date,
        label: s.name,
        color,
        href: `/trips/${tripId}/stops/${s.id}`,
        kind: "stop",
      })),
    ...flights
      .filter((f) => f.depart_at)
      .map<CalEvent>((f) => ({
        start: f.depart_at!.slice(0, 10),
        label: `${f.from_airport ?? ""}→${f.to_airport ?? ""} ${f.depart_at!.slice(11, 16)}`,
        color: "#463f37",
        kind: "flight",
      })),
    ...cars.flatMap<CalEvent>((c) => [
      ...(c.pickup_at
        ? [{ start: c.pickup_at.slice(0, 10), label: `Abholung ${time(c.pickup_at)}${c.pickup_place ? " " + c.pickup_place : ""}`, color: "#463f37", kind: "car" as const }]
        : []),
      ...(c.dropoff_at
        ? [{ start: c.dropoff_at.slice(0, 10), label: `Rückgabe ${time(c.dropoff_at)}${c.dropoff_place ? " " + c.dropoff_place : ""}`, color: "#463f37", kind: "car" as const }]
        : []),
    ]),
    ...gaps.map<CalEvent>((g) => ({
      start: g.start,
      end: addDays(g.end, -1),
      label: "Offen",
      color: "#c2603a",
      kind: "gap",
    })),
    ...activities
      .filter((a) => a.date)
      .map<CalEvent>((a) => ({
        start: a.date!,
        label: `${a.category === "restaurant" ? "🍽 " : ""}${a.time ? a.time.slice(0, 5) + " " : ""}${a.title}`,
        color: "#2e6553",
        href: `/trips/${tripId}/stops/${a.stop_id}`,
        kind: "activity",
      })),
  ];
  const calStart = trip.start_date ?? stops[0]?.start_date;
  const calEnd = trip.end_date ?? stops.at(-1)?.end_date ?? calStart;
  const months = calStart && calEnd ? monthsBetween(calStart, calEnd) : [];
  const heroImage = stopCovers.get(stops.find((s) => stopCovers.has(s.id))?.id ?? -1);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <Link href="/" className="btn-ghost -ml-3 mb-3 px-3 py-1.5 text-xs">← Alle Reisen</Link>
        <Cover color={color} image={heroImage} className="min-h-[300px] sm:min-h-[380px]" rounded="rounded-[2rem]">
          <div className="flex min-h-[300px] flex-col justify-end p-6 pb-14 text-white sm:min-h-[380px] sm:p-10 sm:pb-16">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                {trip.destination && <p className="eyebrow text-white/75">{trip.destination}</p>}
                <h1 className="font-display mt-1 text-5xl leading-none font-light sm:text-7xl">{trip.name}</h1>
                <p className="mt-3 text-white/90">
                  {fmtRange(trip.start_date, trip.end_date)}
                  {nights ? ` · ${nights} Nächte` : ""}
                </p>
              </div>
              {daysUntil != null && (
                <div className="rounded-2xl bg-white/15 px-5 py-3 text-right backdrop-blur-md">
                  <div className="font-display text-5xl leading-none">{daysUntil}</div>
                  <div className="text-[11px] tracking-wider text-white/80 uppercase">Tage bis zum Abflug</div>
                </div>
              )}
            </div>
          </div>
        </Cover>

        {/* Kennzahlen */}
        <div className="card relative z-10 mx-3 -mt-8 grid grid-cols-2 divide-line sm:mx-8 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          <Stat label="Gesamtbudget" value={fmtMoney(total)} strong note={favCost > 0 ? "inkl. Favoriten" : undefined} />
          <Stat label="Flüge" value={fmtMoney(flightCost)} />
          <Stat
            label="Unterkünfte"
            value={fmtMoney(hotelCost)}
            note={favCost > 0 ? `${fmtMoney(bookedCost)} gebucht · ${fmtMoney(favCost)} Favoriten` : bookedCost > 0 ? "alles gebucht" : undefined}
          />
          <Stat label="Mietwagen" value={fmtMoney(carCost)} note={cars.some((c) => !c.booked && c.price != null) ? "noch nicht alles gebucht" : undefined} />
          <Stat label="Aktivitäten" value={fmtMoney(actCost)} />
        </div>

        {trip.notes && (
          <p className="font-display mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed whitespace-pre-line text-slate-600 italic">
            „{trip.notes}“
          </p>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Route */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Die Route</p>
              <h2 className="h2">{stops.length} {stops.length === 1 ? "Stopp" : "Stopps"}</h2>
            </div>
            {nights && plannedNights != null && (
              <div className="min-w-48">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{openNights > 0 ? `${openNights} ${openNights === 1 ? "Nacht" : "Nächte"} offen` : "Alle Nächte geplant ✓"}</span>
                  <span>{plannedNights}/{nights}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-deep">
                  <div
                    className={`h-full rounded-full ${openNights > 0 ? "bg-clay" : "bg-sky-600"}`}
                    style={{ width: `${Math.max(4, (plannedNights / nights) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <ol className="relative">
            {/* Zeitleiste */}
            {route.length > 0 && <span className="absolute top-6 bottom-6 left-[19px] w-px bg-gradient-to-b from-line via-slate-300 to-line" aria-hidden />}
            {stops.length === 0 && gaps.length === 0 && (
              <li className="card p-8 text-center text-sm text-slate-500">Noch keine Stopps. Füge unten z. B. „Montreal“ hinzu.</li>
            )}
            {route.map((item) => {
              if (item.kind === "gap") return <GapCard key={`gap-${item.key}`} gap={item.gap} tripId={trip.id} />;
              const i = item.idx;
              const s = stops[i];
              const hs = hotels.filter((h) => h.stop_id === s.id && h.status !== "rejected");
              const acts = activities.filter((a) => a.stop_id === s.id);
              const pick = chosenFor(s.id);
              const n = nightsBetween(s.start_date, s.end_date);
              const img = stopCovers.get(s.id);
              return (
                <li key={s.id} className="relative pb-4 pl-14">
                  <span
                    className="absolute top-5 left-0 grid h-10 w-10 place-items-center rounded-full border-4 border-sand text-sm font-semibold text-white shadow-sm"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  <Link href={`/trips/${tripId}/stops/${s.id}`} className="card card-hover group flex overflow-hidden">
                    <div className="hidden w-36 shrink-0 sm:block">
                      <Cover color={color} image={img} className="h-full min-h-32" rounded="rounded-none" shade={false} />
                    </div>
                    <div className="min-w-0 flex-1 p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="font-display text-2xl leading-tight group-hover:text-sky-700">{s.name}</h3>
                        <span className="text-sm text-slate-500 tabular-nums">
                          {fmtRange(s.start_date, s.end_date)}
                          {n ? <span className="text-slate-400"> · {n} {n === 1 ? "Nacht" : "Nächte"}</span> : ""}
                        </span>
                      </div>
                      {s.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {pick ? (
                          <span className={`chip max-w-full ${pick.booked ? "bg-sky-50 text-sky-800" : "bg-gold/10 text-[#8a6620]"}`}>
                            <span className="shrink-0">{pick.booked ? "✓" : "★"}</span>
                            <span className="truncate">{pick.hotel.name}</span>
                            {pick.price != null && (
                              <span className="shrink-0 font-semibold">· {fmtMoney(pick.price, pick.hotel.currency)}</span>
                            )}
                          </span>
                        ) : hs.length ? (
                          <span className="chip bg-gold/10 text-[#8a6620]">
                            {hs.length} {hs.length === 1 ? "Unterkunft" : "Unterkünfte"} in Auswahl
                          </span>
                        ) : (
                          <span className="chip bg-clay/10 text-clay">Noch keine Unterkunft</span>
                        )}
                        {acts.filter((a) => a.category !== "restaurant").length > 0 && (
                          <span className="chip bg-slate-100 text-slate-600">{acts.filter((a) => a.category !== "restaurant").length} geplant</span>
                        )}
                        {acts.some((a) => a.category === "restaurant") && (
                          <span className="chip bg-slate-100 text-slate-600">🍽 {acts.filter((a) => a.category === "restaurant").length}</span>
                        )}
                      </div>
                    </div>
                    <span className="self-center pr-5 text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-ink">→</span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <details className="card group mt-2 ml-14">
            <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm font-medium text-slate-600 hover:text-ink">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-sand-deep text-base transition group-open:rotate-45">+</span>
              Stopp hinzufügen
            </summary>
            <form action={createStop} className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
              <input type="hidden" name="trip_id" value={trip.id} />
              <div className="sm:col-span-2">
                <label className="label">Ort</label>
                <input name="name" required placeholder="Montreal" className="input" />
              </div>
              <div>
                <label className="label">Ankunft</label>
                <input type="date" name="start_date" defaultValue={stops.at(-1)?.end_date ?? trip.start_date ?? ""} className="input" />
              </div>
              <div>
                <label className="label">Abreise</label>
                <input type="date" name="end_date" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Kurzbeschreibung</label>
                <textarea name="description" rows={2} className="input" />
              </div>
              <SubmitButton className="btn-primary sm:col-span-2">Stopp anlegen</SubmitButton>
            </form>
          </details>
        </section>

        {/* Flüge */}
        <section>
          <p className="eyebrow">Unterwegs</p>
          <h2 className="h2 mb-5">Flüge</h2>
          <div className="space-y-4">
            {flights.length === 0 && (
              <div className="card p-6 text-center text-sm text-slate-500">Noch keine Flüge eingetragen.</div>
            )}
            {flights.map((f) => (
              <FlightCard key={f.id} f={f} files={files.filter((x) => x.flight_id === f.id)} />
            ))}
            <details className="card group">
              <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm font-medium text-slate-600 hover:text-ink">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-sand-deep text-base transition group-open:rotate-45">+</span>
                Flug hinzufügen
              </summary>
              <form action={createFlight} className="border-t border-line p-4">
                <input type="hidden" name="trip_id" value={trip.id} />
                <FlightFields />
                <SubmitButton className="btn-primary mt-4 w-full">Flug speichern</SubmitButton>
              </form>
            </details>
          </div>

          <p className="eyebrow mt-10">Auf der Straße</p>
          <h2 className="h2 mb-5">Mietwagen</h2>
          <div className="space-y-4">
            {cars.length === 0 && (
              <div className="card p-6 text-center text-sm text-slate-500">Noch kein Mietwagen eingetragen.</div>
            )}
            {cars.map((c) => (
              <CarCard key={c.id} c={c} files={carFiles.filter((x) => x.car_id === c.id)} />
            ))}
            <details className="card group">
              <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm font-medium text-slate-600 hover:text-ink">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-sand-deep text-base transition group-open:rotate-45">+</span>
                Mietwagen hinzufügen
              </summary>
              <form action={createCar} className="border-t border-line p-4">
                <input type="hidden" name="trip_id" value={trip.id} />
                <CarFields defaults={{ pickup_at: trip.start_date ? `${trip.start_date}T12:00` : "", dropoff_at: trip.end_date ? `${trip.end_date}T10:00` : "" }} />
                <SubmitButton className="btn-primary mt-4 w-full">Mietwagen speichern</SubmitButton>
              </form>
            </details>
          </div>
        </section>
      </div>

      {months.length > 0 && (
        <section>
          <p className="eyebrow">Tag für Tag</p>
          <h2 className="h2 mb-5">Reisekalender</h2>
          <div className="grid gap-5 xl:grid-cols-2">
            {months.map((m) => (
              <Month key={`${m.year}-${m.month}`} {...m} events={events} today={today} compact />
            ))}
          </div>
        </section>
      )}

      <details className="card group">
        <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium text-slate-600 hover:text-ink">
          <span>Urlaub bearbeiten</span>
          <span className="transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-5">
          <form action={updateTrip}>
            <input type="hidden" name="id" value={trip.id} />
            <TripFields trip={trip} />
            <SubmitButton className="btn-primary mt-4">Speichern</SubmitButton>
          </form>
          <form action={deleteTrip}>
            <input type="hidden" name="id" value={trip.id} />
            <ConfirmButton message="Den ganzen Urlaub inkl. Stopps, Hotels und Flügen löschen?">Urlaub löschen</ConfirmButton>
          </form>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, strong = false, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] tracking-wider text-slate-500 uppercase">{label}</div>
      <div className={`font-display mt-0.5 tabular-nums ${strong ? "text-3xl" : "text-2xl text-slate-700"}`}>{value}</div>
      {note && <div className="mt-0.5 text-[11px] text-slate-400">{note}</div>}
    </div>
  );
}

function FlightFields({ f }: { f?: Flight }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Airline</label>
        <input name="airline" defaultValue={f?.airline ?? ""} placeholder="Air Canada" className="input" />
      </div>
      <div>
        <label className="label">Flugnummer</label>
        <input name="flight_no" defaultValue={f?.flight_no ?? ""} placeholder="AC 847" className="input" />
      </div>
      <div>
        <label className="label">Von</label>
        <input name="from_airport" defaultValue={f?.from_airport ?? ""} placeholder="FRA" className="input" />
      </div>
      <div>
        <label className="label">Nach</label>
        <input name="to_airport" defaultValue={f?.to_airport ?? ""} placeholder="YUL" className="input" />
      </div>
      <div>
        <label className="label">Abflug</label>
        <input type="datetime-local" name="depart_at" defaultValue={f?.depart_at ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Ankunft</label>
        <input type="datetime-local" name="arrive_at" defaultValue={f?.arrive_at ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Buchungscode</label>
        <input name="booking_ref" defaultValue={f?.booking_ref ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Preis (€)</label>
        <input name="price" inputMode="decimal" defaultValue={f?.price ?? ""} className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Link</label>
        <input name="link" type="url" defaultValue={f?.link ?? ""} placeholder="https://…" className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Notizen</label>
        <input name="notes" defaultValue={f?.notes ?? ""} placeholder="Gepäck, Sitzplatz …" className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">{f ? "Weitere Dokumente (PDF/Bild, max. 4 MB)" : "Ticket / Bestätigung (PDF/Bild, max. 4 MB)"}</label>
        <input type="file" name="files" accept="application/pdf,image/*" multiple className="input file:mr-3 file:rounded-full file:border-0 file:bg-sand-deep file:px-3 file:py-1 file:text-xs" />
      </div>
    </div>
  );
}

const time = (dt?: string | null) => (dt && dt.length > 10 ? dt.slice(11, 16) : "––:––");

function FlightCard({ f, files }: { f: Flight; files: FlightFile[] }) {
  return (
    <div className="card overflow-hidden">
      {/* Bordkarte */}
      <div className="p-5">
        <div className="flex items-center justify-between text-[11px] tracking-wider text-slate-500 uppercase">
          <span>{[f.airline, f.flight_no].filter(Boolean).join(" · ") || "Flug"}</span>
          <span>{f.depart_at ? fmtShort(f.depart_at.slice(0, 10)) : ""}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div>
            <div className="font-display text-4xl leading-none">{f.from_airport || "???"}</div>
            <div className="mt-1 text-sm text-slate-500 tabular-nums">{time(f.depart_at)}</div>
          </div>
          <div className="relative flex flex-1 items-center">
            <span className="h-px flex-1 border-t border-dashed border-slate-300" />
            <span className="mx-2 text-lg text-sky-600">✈</span>
            <span className="h-px flex-1 border-t border-dashed border-slate-300" />
          </div>
          <div className="text-right">
            <div className="font-display text-4xl leading-none">{f.to_airport || "???"}</div>
            <div className="mt-1 text-sm text-slate-500 tabular-nums">
              {time(f.arrive_at)}
              {f.arrive_at && f.depart_at && f.arrive_at.slice(0, 10) !== f.depart_at.slice(0, 10) && <sup className="ml-0.5 text-clay">+1</sup>}
            </div>
          </div>
        </div>
      </div>
      {/* Abriss */}
      <div className="relative flex items-center">
        <span className="absolute -left-3 h-6 w-6 rounded-full border border-line bg-sand" />
        <span className="mx-5 w-full border-t-2 border-dotted border-line" />
        <span className="absolute -right-3 h-6 w-6 rounded-full border border-line bg-sand" />
      </div>
      <div className="space-y-3 p-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-slate-600">
            {f.booking_ref ? (
              <>
                Code <span className="font-mono font-semibold tracking-wider text-ink">{f.booking_ref}</span>
              </>
            ) : (
              <span className="text-slate-400">Kein Buchungscode</span>
            )}
          </div>
          {f.price != null && <span className="font-display text-xl">{fmtMoney(f.price)}</span>}
        </div>
        {f.notes && <p className="text-xs text-slate-500">{f.notes}</p>}
        <div className="space-y-1.5">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 rounded-xl bg-sand/70 px-3 py-2 text-sm">
              <span>{file.mime?.startsWith("image/") ? "🖼" : "📄"}</span>
              <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium text-ink hover:text-sky-700">
                {file.filename}
              </a>
              {file.size != null && <span className="text-[11px] text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>}
              <a href={`/api/files/${file.id}?download`} className="text-xs text-slate-500 hover:text-ink" title="Herunterladen">⬇</a>
              <form action={deleteFlightFile}>
                <input type="hidden" name="id" value={file.id} />
                <ConfirmButton className="cursor-pointer text-xs text-slate-400 hover:text-red-600" message={`${file.filename} löschen?`}>✕</ConfirmButton>
              </form>
            </div>
          ))}
          <AutoUpload action={uploadFlightFiles} id={f.id} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {f.link && (
            <a href={f.link} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1.5 text-xs">
              Buchung öffnen ↗
            </a>
          )}
          <details className="w-full">
            <summary className="btn-ghost px-3 py-1.5 text-xs">Bearbeiten</summary>
            <form action={updateFlight} className="pt-3">
              <input type="hidden" name="id" value={f.id} />
              <FlightFields f={f} />
              <SubmitButton className="btn-primary mt-3">Speichern</SubmitButton>
            </form>
            <form action={deleteFlight} className="mt-2">
              <input type="hidden" name="id" value={f.id} />
              <ConfirmButton message="Flug löschen?">Flug löschen</ConfirmButton>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}

function GapCard({ gap, tripId }: { gap: Gap; tripId: number }) {
  return (
    <li className="relative pb-4 pl-14">
      <span className="absolute top-4 left-0 grid h-10 w-10 place-items-center rounded-full border-2 border-dashed border-clay/60 bg-sand text-clay">?</span>
      <details className="group rounded-3xl border-2 border-dashed border-clay/40 bg-clay/5">
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 p-5">
          <div>
            <h3 className="font-display text-xl text-clay">Noch nicht geplant</h3>
            <p className="text-xs text-clay/80">Hier fehlt ein Ort – tippen, um einen Stopp für diese Zeit anzulegen.</p>
          </div>
          <span className="text-sm text-clay tabular-nums">
            {fmtRange(gap.start, gap.end)} · {gap.nights} {gap.nights === 1 ? "Nacht" : "Nächte"}
          </span>
        </summary>
        <form action={createStop} className="grid gap-3 px-5 pb-5 sm:grid-cols-[1fr_auto_auto_auto]">
          <input type="hidden" name="trip_id" value={tripId} />
          <input name="name" required placeholder="Ort, z. B. Ottawa" className="input" />
          <input type="date" name="start_date" defaultValue={gap.start} className="input" />
          <input type="date" name="end_date" defaultValue={gap.end} className="input" />
          <SubmitButton className="btn-primary">Anlegen</SubmitButton>
        </form>
      </details>
    </li>
  );
}

function CarFields({ c, defaults }: { c?: Car; defaults?: { pickup_at?: string; dropoff_at?: string } }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Anbieter</label>
        <input name="company" defaultValue={c?.company ?? ""} placeholder="Hertz, Sixt …" className="input" />
      </div>
      <div>
        <label className="label">Fahrzeug / Klasse</label>
        <input name="car_type" defaultValue={c?.car_type ?? ""} placeholder="SUV, Toyota RAV4" className="input" />
      </div>
      <div>
        <label className="label">Abholung – Ort</label>
        <input name="pickup_place" defaultValue={c?.pickup_place ?? ""} placeholder="Flughafen YUL" className="input" />
      </div>
      <div>
        <label className="label">Abholung – Zeit</label>
        <input type="datetime-local" name="pickup_at" defaultValue={c?.pickup_at ?? defaults?.pickup_at ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Rückgabe – Ort</label>
        <input name="dropoff_place" defaultValue={c?.dropoff_place ?? ""} placeholder="Flughafen YYZ" className="input" />
      </div>
      <div>
        <label className="label">Rückgabe – Zeit</label>
        <input type="datetime-local" name="dropoff_at" defaultValue={c?.dropoff_at ?? defaults?.dropoff_at ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Buchungscode</label>
        <input name="booking_ref" defaultValue={c?.booking_ref ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Gesamtpreis (€)</label>
        <input name="price" inputMode="decimal" defaultValue={c?.price ?? ""} className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Link</label>
        <input name="link" type="url" defaultValue={c?.link ?? ""} placeholder="https://…" className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Notizen</label>
        <input name="notes" defaultValue={c?.notes ?? ""} placeholder="Versicherung, Einwegmiete, Zusatzfahrer …" className="input" />
      </div>
      <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="booked" defaultChecked={c?.booked ?? false} className="h-4 w-4 accent-[#2e6553]" />
        Schon gebucht
      </label>
      <div className="col-span-2">
        <label className="label">{c ? "Weitere Dokumente (PDF/Bild, max. 4 MB)" : "Buchungsbestätigung (PDF/Bild, max. 4 MB)"}</label>
        <input type="file" name="files" accept="application/pdf,image/*" multiple className="input file:mr-3 file:rounded-full file:border-0 file:bg-sand-deep file:px-3 file:py-1 file:text-xs" />
      </div>
    </div>
  );
}

function CarCard({ c, files }: { c: Car; files: FlightFile[] }) {
  const pickupDay = c.pickup_at?.slice(0, 10);
  const dropDay = c.dropoff_at?.slice(0, 10);
  // Miettage wie bei Vermietern: angefangene 24 h zählen als Tag
  const days =
    c.pickup_at && c.dropoff_at
      ? Math.max(1, Math.ceil((Date.parse(c.dropoff_at) - Date.parse(c.pickup_at)) / 86400000))
      : null;
  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 text-[11px] tracking-wider text-slate-500 uppercase">
          <span>{[c.company, c.car_type].filter(Boolean).join(" · ") || "Mietwagen"}</span>
          <span className={`chip normal-case tracking-normal ${c.booked ? "bg-sky-50 text-sky-800" : "bg-gold/10 text-[#8a6620]"}`}>
            {c.booked ? "✓ Gebucht" : "Angebot"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <div className="text-[11px] tracking-wider text-slate-400 uppercase">Abholung</div>
            <div className="font-display text-xl leading-tight">{pickupDay ? fmtShort(pickupDay) : "–"}</div>
            <div className="text-sm text-slate-500 tabular-nums">{time(c.pickup_at)}</div>
            {c.pickup_place && <div className="mt-0.5 truncate text-xs text-slate-600">{c.pickup_place}</div>}
          </div>
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-xl">🚗</span>
            {days && <span className="mt-1 text-[11px] whitespace-nowrap">{days} {days === 1 ? "Tag" : "Tage"}</span>}
          </div>
          <div className="text-right">
            <div className="text-[11px] tracking-wider text-slate-400 uppercase">Rückgabe</div>
            <div className="font-display text-xl leading-tight">{dropDay ? fmtShort(dropDay) : "–"}</div>
            <div className="text-sm text-slate-500 tabular-nums">{time(c.dropoff_at)}</div>
            {c.dropoff_place && <div className="mt-0.5 truncate text-xs text-slate-600">{c.dropoff_place}</div>}
          </div>
        </div>
      </div>
      <div className="relative flex items-center">
        <span className="absolute -left-3 h-6 w-6 rounded-full border border-line bg-sand" />
        <span className="mx-5 w-full border-t-2 border-dotted border-line" />
        <span className="absolute -right-3 h-6 w-6 rounded-full border border-line bg-sand" />
      </div>
      <div className="space-y-3 p-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-slate-600">
            {c.booking_ref ? (
              <>
                Code <span className="font-mono font-semibold tracking-wider text-ink">{c.booking_ref}</span>
              </>
            ) : (
              <span className="text-slate-400">Kein Buchungscode</span>
            )}
          </div>
          {c.price != null && (
            <div className="text-right">
              <div className="font-display text-xl">{fmtMoney(c.price)}</div>
              {days && <div className="text-[11px] text-slate-400">{fmtMoney(c.price / days)} / Tag</div>}
            </div>
          )}
        </div>
        {c.notes && <p className="text-xs text-slate-500">{c.notes}</p>}
        <div className="space-y-1.5">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 rounded-xl bg-sand/70 px-3 py-2 text-sm">
              <span>{file.mime?.startsWith("image/") ? "🖼" : "📄"}</span>
              <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium text-ink hover:text-sky-700">
                {file.filename}
              </a>
              {file.size != null && <span className="text-[11px] text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>}
              <a href={`/api/files/${file.id}?download`} className="text-xs text-slate-500 hover:text-ink" title="Herunterladen">⬇</a>
              <form action={deleteFlightFile}>
                <input type="hidden" name="id" value={file.id} />
                <ConfirmButton className="cursor-pointer text-xs text-slate-400 hover:text-red-600" message={`${file.filename} löschen?`}>✕</ConfirmButton>
              </form>
            </div>
          ))}
          <AutoUpload action={uploadCarFiles} id={c.id} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {c.link && (
            <a href={c.link} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1.5 text-xs">
              Buchung öffnen ↗
            </a>
          )}
          <details className="w-full">
            <summary className="btn-ghost px-3 py-1.5 text-xs">Bearbeiten</summary>
            <form action={updateCar} className="pt-3">
              <input type="hidden" name="id" value={c.id} />
              <CarFields c={c} />
              <SubmitButton className="btn-primary mt-3">Speichern</SubmitButton>
            </form>
            <form action={deleteCar} className="mt-2">
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton message="Mietwagen löschen?">Mietwagen löschen</ConfirmButton>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
