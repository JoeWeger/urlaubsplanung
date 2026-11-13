import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createFlight,
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
  getFlightFiles,
  getFlights,
  getHotelsForTrip,
  getStops,
  getTrip,
  type Flight,
  type FlightFile,
} from "@/lib/data";
import { addDays, fmtDateTime, fmtMoney, fmtRange, nightsBetween, toISODate } from "@/lib/format";
import { Month, monthsBetween, type CalEvent } from "@/components/Calendar";
import { TripFields } from "@/components/TripForm";
import { AutoUpload, ConfirmButton, SubmitButton } from "@/components/ui";
import { findGaps, type Gap } from "@/lib/gaps";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const tripId = Number((await params).id);
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  const [stops, flights, hotels, activities, files] = await Promise.all([
    getStops(tripId),
    getFlights(tripId),
    getHotelsForTrip(tripId),
    getActivitiesForTrip(tripId),
    getFlightFiles(tripId),
  ]);
  const gaps = findGaps(trip.start_date, trip.end_date, stops);
  const openNights = gaps.reduce((a, g) => a + g.nights, 0);
  type RouteItem = { kind: "stop"; key: string; idx: number } | { kind: "gap"; key: string; gap: Gap };
  const route: RouteItem[] = [
    ...stops.map((s, idx) => ({ kind: "stop" as const, key: s.start_date ?? "9999", idx })),
    ...gaps.map((gap) => ({ kind: "gap" as const, key: gap.start, gap })),
  ].sort((a, b) => a.key.localeCompare(b.key) || (a.kind === "gap" ? -1 : 1));
  const color = trip.color ?? "#0ea5e9";
  const nights = nightsBetween(trip.start_date, trip.end_date);

  // Budget
  const flightCost = flights.reduce((a, f) => a + (f.price ?? 0), 0);
  const booked = hotels.filter((h) => h.status === "booked");
  const hotelCost = booked.reduce((a, h) => a + (h.price_total ?? 0), 0);
  const actCost = activities.reduce((a, x) => a + (x.cost ?? 0), 0);

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
        color: "#475569",
        kind: "flight",
      })),
    ...gaps.map<CalEvent>((g) => ({
      start: g.start,
      end: addDays(g.end, -1),
      label: "Offen",
      color: "#dc2626",
      kind: "gap",
    })),
    ...activities
      .filter((a) => a.date)
      .map<CalEvent>((a) => ({
        start: a.date!,
        label: `${a.time ? a.time.slice(0, 5) + " " : ""}${a.title}`,
        color: "#16a34a",
        href: `/trips/${tripId}/stops/${a.stop_id}`,
        kind: "activity",
      })),
  ];
  const calStart = trip.start_date ?? stops[0]?.start_date;
  const calEnd = trip.end_date ?? stops.at(-1)?.end_date ?? calStart;
  const months = calStart && calEnd ? monthsBetween(calStart, calEnd) : [];
  const today = toISODate(new Date());

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="card overflow-hidden">
        <div className="h-2" style={{ background: color }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">← Alle Urlaube</Link>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <p className="text-slate-600">
              {trip.destination && <>{trip.destination} · </>}
              {fmtRange(trip.start_date, trip.end_date)}
              {nights ? ` · ${nights} Nächte` : ""}
            </p>
            {trip.notes && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-slate-500">{trip.notes}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <Stat label="Flüge" value={fmtMoney(flightCost)} />
            <Stat label="Hotels (gebucht)" value={fmtMoney(hotelCost)} />
            <Stat label="Aktivitäten" value={fmtMoney(actCost)} />
          </div>
        </div>
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer px-5 py-2.5 text-sm text-slate-500 hover:bg-slate-50">✏️ Urlaub bearbeiten</summary>
          <div className="flex flex-col gap-3 p-5 pt-2">
            <form action={updateTrip}>
              <input type="hidden" name="id" value={trip.id} />
              <TripFields trip={trip} />
              <SubmitButton className="btn-primary mt-3">Speichern</SubmitButton>
            </form>
            <form action={deleteTrip}>
              <input type="hidden" name="id" value={trip.id} />
              <ConfirmButton message="Den ganzen Urlaub inkl. Stopps, Hotels und Flügen löschen?">Urlaub löschen</ConfirmButton>
            </form>
          </div>
        </details>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Route / Stopps */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">Route</h2>
            {openNights > 0 ? (
              <span className="chip bg-red-50 text-red-700">⚠ {openNights} {openNights === 1 ? "Nacht" : "Nächte"} noch ohne Plan</span>
            ) : stops.length > 0 && trip.start_date && trip.end_date ? (
              <span className="chip bg-emerald-50 text-emerald-700">✓ Alle Nächte geplant</span>
            ) : null}
          </div>
          <div className="relative space-y-3">
            {stops.length === 0 && (
              <div className="card p-6 text-center text-sm text-slate-500">Noch keine Stopps. Füge z. B. „Montreal“ hinzu.</div>
            )}
            {route.map((item) => {
              if (item.kind === "gap") return <GapCard key={`gap-${item.key}`} gap={item.gap} tripId={trip.id} />;
              const i = item.idx;
              const s = stops[i];
              const hs = hotels.filter((h) => h.stop_id === s.id);
              const acts = activities.filter((a) => a.stop_id === s.id);
              const bookedHotel = hs.find((h) => h.status === "booked");
              const n = nightsBetween(s.start_date, s.end_date);
              return (
                <Link
                  key={s.id}
                  href={`/trips/${tripId}/stops/${s.id}`}
                  className="card group flex gap-4 p-4 transition hover:shadow-md"
                >
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-semibold group-hover:text-sky-700">{s.name}</h3>
                      <span className="text-sm text-slate-500">
                        {fmtRange(s.start_date, s.end_date)}
                        {n ? ` · ${n} N.` : ""}
                      </span>
                    </div>
                    {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{s.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {bookedHotel ? (
                        <span className="chip bg-emerald-50 text-emerald-700">✓ {bookedHotel.name}</span>
                      ) : (
                        <span className="chip bg-amber-50 text-amber-700">
                          🏨 {hs.length} {hs.length === 1 ? "Hotel" : "Hotels"} in Auswahl
                        </span>
                      )}
                      <span className="chip bg-slate-100 text-slate-600">📍 {acts.length} geplant</span>
                    </div>
                  </div>
                  <span className="self-center text-slate-300 group-hover:text-sky-600">›</span>
                </Link>
              );
            })}
          </div>

          <details className="card mt-3">
            <summary className="btn-ghost w-full justify-start px-4 py-3">＋ Stopp hinzufügen</summary>
            <form action={createStop} className="grid gap-3 p-4 pt-0 sm:grid-cols-2">
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
          <h2 className="h2 mb-3">Flüge</h2>
          <div className="space-y-3">
            {flights.length === 0 && <div className="card p-4 text-sm text-slate-500">Noch keine Flüge eingetragen.</div>}
            {flights.map((f) => (
              <FlightCard key={f.id} f={f} files={files.filter((x) => x.flight_id === f.id)} />
            ))}
            <details className="card">
              <summary className="btn-ghost w-full justify-start px-4 py-3">＋ Flug hinzufügen</summary>
              <form action={createFlight} className="p-4 pt-0">
                <input type="hidden" name="trip_id" value={trip.id} />
                <FlightFields />
                <SubmitButton className="btn-primary mt-3 w-full">Flug speichern</SubmitButton>
              </form>
            </details>
          </div>
        </section>
      </div>

      {months.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Reisekalender</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {months.map((m) => (
              <Month key={`${m.year}-${m.month}`} {...m} events={events} today={today} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="font-semibold">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
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
        <input type="file" name="files" accept="application/pdf,image/*" multiple className="input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
      </div>
    </div>
  );
}

function FlightCard({ f, files }: { f: Flight; files: FlightFile[] }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold">
          {f.from_airport || "?"} <span className="text-slate-300">✈</span> {f.to_airport || "?"}
        </div>
        {f.price != null && <span className="text-sm font-medium">{fmtMoney(f.price)}</span>}
      </div>
      <div className="text-sm text-slate-600">
        {[f.airline, f.flight_no].filter(Boolean).join(" · ")}
        {f.booking_ref && <span className="text-slate-400"> · Code {f.booking_ref}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div><div className="text-slate-400">Abflug</div>{fmtDateTime(f.depart_at)}</div>
        <div><div className="text-slate-400">Ankunft</div>{fmtDateTime(f.arrive_at)}</div>
      </div>
      {f.notes && <p className="mt-2 text-xs text-slate-500">{f.notes}</p>}
      <div className="mt-3 space-y-1">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-sm">
            <span>{file.mime?.startsWith("image/") ? "🖼" : "📄"}</span>
            <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sky-700 hover:underline">
              {file.filename}
            </a>
            {file.size != null && <span className="text-[11px] text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span>}
            <a href={`/api/files/${file.id}?download`} className="text-xs text-slate-500 hover:text-slate-800" title="Herunterladen">⬇</a>
            <form action={deleteFlightFile}>
              <input type="hidden" name="id" value={file.id} />
              <ConfirmButton className="cursor-pointer text-xs text-slate-400 hover:text-red-600" message={`${file.filename} löschen?`}>✕</ConfirmButton>
            </form>
          </div>
        ))}
        <AutoUpload action={uploadFlightFiles} id={f.id} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {f.link && (
          <a href={f.link} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2 py-1 text-xs text-sky-700">
            Buchung öffnen ↗
          </a>
        )}
        <details className="w-full">
          <summary className="btn-ghost px-2 py-1 text-xs">Bearbeiten</summary>
          <form action={updateFlight} className="pt-2">
            <input type="hidden" name="id" value={f.id} />
            <FlightFields f={f} />
            <div className="mt-3 flex gap-2">
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </form>
          <form action={deleteFlight} className="mt-2">
            <input type="hidden" name="id" value={f.id} />
            <ConfirmButton message="Flug löschen?">Flug löschen</ConfirmButton>
          </form>
        </details>
      </div>
    </div>
  );
}

function GapCard({ gap, tripId }: { gap: Gap; tripId: number }) {
  return (
    <details className="rounded-2xl border-2 border-dashed border-red-300 bg-red-50/60">
      <summary className="flex cursor-pointer items-center gap-4 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-dashed border-red-300 text-lg text-red-400">?</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-red-700">Noch nicht geplant</h3>
            <span className="text-sm text-red-600">
              {fmtRange(gap.start, gap.end)} · {gap.nights} {gap.nights === 1 ? "Nacht" : "Nächte"}
            </span>
          </div>
          <p className="text-xs text-red-500">Hier fehlt noch ein Ort / eine Unterkunft. Klicken, um einen Stopp für diese Zeit anzulegen.</p>
        </div>
      </summary>
      <form action={createStop} className="grid gap-3 px-4 pb-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input type="hidden" name="trip_id" value={tripId} />
        <input name="name" required placeholder="Ort, z. B. Ottawa" className="input" />
        <input type="date" name="start_date" defaultValue={gap.start} className="input" />
        <input type="date" name="end_date" defaultValue={gap.end} className="input" />
        <SubmitButton>Stopp anlegen</SubmitButton>
      </form>
    </details>
  );
}
