import Link from "next/link";
import { createTrip } from "./actions";
import { getAllStops, getTrips, type Stop, type Trip } from "@/lib/data";
import { fmtRange, nightsBetween, toISODate } from "@/lib/format";
import { SetupNotice } from "@/components/SetupNotice";
import { TripFields } from "@/components/TripForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  let trips: Trip[] = [];
  let stops: Stop[] = [];
  try {
    [trips, stops] = await Promise.all([getTrips(), getAllStops()]);
  } catch (e) {
    return <SetupNotice error={(e as Error).message} />;
  }
  const today = toISODate(new Date());
  const upcoming = trips.filter((t) => !t.end_date || t.end_date >= today);
  const past = trips.filter((t) => t.end_date && t.end_date < today);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Meine Urlaube</h1>
        {trips.length === 0 && (
          <div className="card p-8 text-center text-slate-500">
            Noch kein Urlaub angelegt. Leg rechts deinen ersten an – z. B. „Kanada“.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {upcoming.map((t) => (
            <TripCard key={t.id} trip={t} stops={stops.filter((s) => s.trip_id === t.id)} today={today} />
          ))}
        </div>
        {past.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Vergangen</h2>
            <div className="grid gap-4 opacity-75 sm:grid-cols-2">
              {past.map((t) => (
                <TripCard key={t.id} trip={t} stops={stops.filter((s) => s.trip_id === t.id)} today={today} />
              ))}
            </div>
          </>
        )}
      </section>

      <aside>
        <form action={createTrip} className="card sticky top-20 p-5">
          <h2 className="h2 mb-4">Neuer Urlaub</h2>
          <TripFields />
          <button className="btn-primary mt-4 w-full">Urlaub anlegen</button>
        </form>
      </aside>
    </div>
  );
}

function TripCard({ trip, stops, today }: { trip: Trip; stops: Stop[]; today: string }) {
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const daysUntil = trip.start_date ? nightsBetween(today, trip.start_date) : null;
  return (
    <Link href={`/trips/${trip.id}`} className="card group overflow-hidden transition hover:shadow-md">
      <div className="h-2" style={{ background: trip.color ?? "#0ea5e9" }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold group-hover:text-sky-700">{trip.name}</h3>
            {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
          </div>
          {daysUntil != null && (
            <span className="chip bg-sky-50 text-sky-700">in {daysUntil} Tagen</span>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-700">
          📅 {fmtRange(trip.start_date, trip.end_date)}
          {nights ? <span className="text-slate-400"> · {nights} Nächte</span> : null}
        </p>
        {stops.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-slate-600">
            {stops.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">→</span>}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{s.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
