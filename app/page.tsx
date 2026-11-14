import Link from "next/link";
import { createTrip } from "./actions";
import { getAllStops, getTripCovers, getTrips, type Stop, type Trip } from "@/lib/data";
import { fmtRange, nightsBetween, toISODate, tripColor } from "@/lib/format";
import { SetupNotice } from "@/components/SetupNotice";
import { TripFields } from "@/components/TripForm";
import { Cover } from "@/components/Cover";
import { SubmitButton } from "@/components/ui";
import { findGaps } from "@/lib/gaps";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("de-DE", { hour: "numeric", hour12: false, timeZone: "Europe/Vienna" }).format(new Date()));
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

export default async function Home() {
  let trips: Trip[] = [];
  let stops: Stop[] = [];
  let covers = new Map<number, string>();
  try {
    [trips, stops, covers] = await Promise.all([getTrips(), getAllStops(), getTripCovers()]);
  } catch (e) {
    return <SetupNotice error={(e as Error).message} />;
  }
  const today = toISODate(new Date());
  const upcoming = trips.filter((t) => !t.end_date || t.end_date >= today);
  const past = trips.filter((t) => t.end_date && t.end_date < today).reverse();
  const [next, ...rest] = upcoming;
  const stopsOf = (t: Trip) => stops.filter((s) => s.trip_id === t.id);

  return (
    <div className="space-y-12">
      <section>
        <p className="eyebrow">{greeting()} ✦</p>
        <h1 className="font-display mt-2 text-4xl leading-[1.05] font-light sm:text-6xl">
          {next ? (
            <>
              Wohin geht&apos;s <em className="text-sky-700">als Nächstes?</em>
            </>
          ) : (
            <>
              Die nächste Reise <em className="text-sky-700">beginnt hier.</em>
            </>
          )}
        </h1>
      </section>

      {next && <FeaturedTrip trip={next} stops={stopsOf(next)} cover={covers.get(next.id)} today={today} />}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rest.length > 0 && (
            <>
              <h2 className="h2 mb-4">Weitere Pläne</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {rest.map((t) => (
                  <TripCard key={t.id} trip={t} stops={stopsOf(t)} cover={covers.get(t.id)} today={today} />
                ))}
              </div>
            </>
          )}
          {trips.length === 0 && (
            <div className="card grid place-items-center p-12 text-center">
              <div className="font-display text-5xl">🧭</div>
              <p className="font-display mt-3 text-2xl">Noch keine Reise geplant</p>
              <p className="mt-1 text-sm text-slate-500">Leg rechts deinen ersten Urlaub an – z. B. „Kanada“.</p>
            </div>
          )}
          {past.length > 0 && (
            <div className="mt-10">
              <h2 className="h2 mb-4 text-slate-500">Erinnerungen</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {past.map((t) => (
                  <TripCard key={t.id} trip={t} stops={stopsOf(t)} cover={covers.get(t.id)} today={today} muted />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className={rest.length > 0 ? "lg:pt-12" : ""}>
          <details className="card group sticky top-24 overflow-hidden" open={trips.length === 0}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-5">
              <div>
                <p className="eyebrow">Neu</p>
                <p className="font-display text-xl">Urlaub anlegen</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-xl text-paper transition group-open:rotate-45">+</span>
            </summary>
            <form action={createTrip} className="border-t border-line p-5">
              <TripFields />
              <SubmitButton className="btn-primary mt-5 w-full py-2.5">Urlaub anlegen</SubmitButton>
            </form>
          </details>
        </aside>
      </section>
    </div>
  );
}

function RouteLine({ stops, light = false }: { stops: Stop[]; light?: boolean }) {
  if (!stops.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${light ? "text-white/85" : "text-slate-600"}`}>
      {stops.map((s, i) => (
        <span key={s.id} className="flex items-center gap-2">
          {i > 0 && <span className={light ? "text-white/40" : "text-slate-300"}>→</span>}
          <span>{s.name}</span>
        </span>
      ))}
    </div>
  );
}

function FeaturedTrip({ trip, stops, cover, today }: { trip: Trip; stops: Stop[]; cover?: string; today: string }) {
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const daysUntil = trip.start_date ? nightsBetween(today, trip.start_date) : null;
  const running = trip.start_date && trip.start_date <= today;
  const open = findGaps(trip.start_date, trip.end_date, stops).reduce((a, g) => a + g.nights, 0);
  return (
    <Link href={`/trips/${trip.id}`} className="group block">
      <Cover
        color={tripColor(trip.color)}
        image={cover}
        className="min-h-[340px] transition duration-500 group-hover:shadow-[var(--shadow-lift)] sm:min-h-[420px]"
        rounded="rounded-[2rem]"
      >
        <div className="flex h-full min-h-[340px] flex-col justify-between p-6 text-white sm:min-h-[420px] sm:p-10">
          <div className="flex items-start justify-between gap-3">
            <span className="chip bg-white/20 text-white backdrop-blur-md">Nächste Reise</span>
            {daysUntil != null && !running && (
              <div className="rounded-2xl bg-white/15 px-4 py-2 text-right backdrop-blur-md">
                <div className="font-display text-4xl leading-none sm:text-5xl">{daysUntil}</div>
                <div className="text-[11px] tracking-wider text-white/80 uppercase">{daysUntil === 1 ? "Tag" : "Tage"} noch</div>
              </div>
            )}
            {running && <span className="chip bg-white text-ink">Gerade unterwegs ✈</span>}
          </div>
          <div>
            {trip.destination && <p className="eyebrow text-white/75">{trip.destination}</p>}
            <h2 className="font-display mt-1 text-5xl leading-none font-light sm:text-7xl">{trip.name}</h2>
            <p className="mt-3 text-white/90">
              {fmtRange(trip.start_date, trip.end_date)}
              {nights ? ` · ${nights} Nächte` : ""}
            </p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <RouteLine stops={stops} light />
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink transition group-hover:gap-3">
                Reise öffnen <span aria-hidden>→</span>
              </span>
            </div>
            {open > 0 && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-clay/90 px-3 py-1 text-xs font-medium">
                ⚠ {open} {open === 1 ? "Nacht" : "Nächte"} noch ohne Plan
              </p>
            )}
          </div>
        </div>
      </Cover>
    </Link>
  );
}

function TripCard({
  trip,
  stops,
  cover,
  today,
  muted = false,
}: {
  trip: Trip;
  stops: Stop[];
  cover?: string;
  today: string;
  muted?: boolean;
}) {
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const daysUntil = trip.start_date ? nightsBetween(today, trip.start_date) : null;
  const open = findGaps(trip.start_date, trip.end_date, stops).reduce((a, g) => a + g.nights, 0);
  return (
    <Link href={`/trips/${trip.id}`} className={`card card-hover group block overflow-hidden ${muted ? "opacity-80 grayscale-[35%] hover:grayscale-0" : ""}`}>
      <Cover color={tripColor(trip.color)} image={cover} className="aspect-[16/10]" rounded="rounded-none">
        <div className="flex h-full flex-col justify-between p-4 text-white">
          <div className="flex justify-end">
            {daysUntil != null && !muted && (
              <span className="chip bg-white/90 text-ink">in {daysUntil} Tagen</span>
            )}
          </div>
          <div>
            {trip.destination && <p className="eyebrow text-white/75">{trip.destination}</p>}
            <h3 className="font-display text-3xl leading-tight">{trip.name}</h3>
          </div>
        </div>
      </Cover>
      <div className="space-y-2 p-4">
        <p className="text-sm text-slate-700">
          {fmtRange(trip.start_date, trip.end_date)}
          {nights ? <span className="text-slate-400"> · {nights} Nächte</span> : null}
        </p>
        <RouteLine stops={stops} />
        {open > 0 && <p className="text-xs font-medium text-clay">⚠ {open} {open === 1 ? "Nacht" : "Nächte"} ohne Plan</p>}
      </div>
    </Link>
  );
}
