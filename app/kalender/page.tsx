import Link from "next/link";
import { getAllStops, getTrips } from "@/lib/data";
import { addDays, toISODate, tripColor } from "@/lib/format";
import { findGaps } from "@/lib/gaps";
import { Month, type CalEvent } from "@/components/Calendar";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function KalenderPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  let events: CalEvent[] = [];
  try {
    const [trips, stops] = await Promise.all([getTrips(), getAllStops()]);
    const color = new Map(trips.map((t) => [t.id, tripColor(t.color)]));
    events = [
      ...trips
        .filter((t) => t.start_date)
        .map<CalEvent>((t) => ({
          start: t.start_date!,
          end: t.end_date,
          label: t.name,
          color: tripColor(t.color),
          href: `/trips/${t.id}`,
          kind: "trip",
        })),
      ...stops
        .filter((s) => s.start_date)
        .map<CalEvent>((s) => ({
          start: s.start_date!,
          end: s.end_date && s.end_date > s.start_date! ? addDays(s.end_date, -1) : s.start_date,
          label: s.name,
          color: color.get(s.trip_id) ?? "#2e6553",
          href: `/trips/${s.trip_id}/stops/${s.id}`,
          kind: "stop",
        })),
      ...trips.flatMap((t) =>
        findGaps(t.start_date, t.end_date, stops.filter((s) => s.trip_id === t.id)).map<CalEvent>((g) => ({
          start: g.start,
          end: addDays(g.end, -1),
          label: "Offen",
          color: "#c2603a",
          href: `/trips/${t.id}`,
          kind: "gap",
        })),
      ),
    ];
  } catch (e) {
    return <SetupNotice error={(e as Error).message} />;
  }

  const now = new Date();
  const [y, mo] = m && /^\d{4}-\d{2}$/.test(m) ? m.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const months = [0, 1, 2].map((i) => {
    const d = new Date(Date.UTC(y, mo - 1 + i, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const prev = key(new Date(Date.UTC(y, mo - 4, 1)));
  const next = key(new Date(Date.UTC(y, mo + 2, 1)));
  const today = toISODate(now);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Überblick</p><h1 className="font-display text-4xl font-light sm:text-5xl">Kalender</h1></div>
        <div className="flex gap-1 rounded-full border border-line bg-paper p-1">
          <Link href={`/kalender?m=${prev}`} className="btn-ghost">← Zurück</Link>
          <Link href="/kalender" className="btn-ghost">Heute</Link>
          <Link href={`/kalender?m=${next}`} className="btn-ghost">Weiter →</Link>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-1">
        {months.map((mm) => (
          <Month key={`${mm.year}-${mm.month}`} {...mm} events={events} today={today} />
        ))}
      </div>
    </div>
  );
}
