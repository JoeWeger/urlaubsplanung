import Link from "next/link";
import { parseDate, toISODate } from "@/lib/format";

export type CalEvent = {
  start: string;
  end?: string | null;
  label: string;
  color: string;
  href?: string;
  kind?: "trip" | "stop" | "flight" | "activity";
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

function monthDays(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Montag = 0
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toISODate(new Date(Date.UTC(year, month, d))));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function covers(e: CalEvent, day: string) {
  const end = e.end || e.start;
  return e.start <= day && day <= end;
}

export function Month({
  year,
  month,
  events,
  today,
  compact = false,
}: {
  year: number;
  month: number;
  events: CalEvent[];
  today: string;
  compact?: boolean;
}) {
  const cells = monthDays(year, month);
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-2.5 font-semibold capitalize">
        {monthFmt.format(new Date(Date.UTC(year, month, 1)))}
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-medium text-slate-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-12 border-b border-r border-slate-100 bg-slate-50/50" />;
          const evs = events.filter((e) => covers(e, day));
          const isToday = day === today;
          const dayNum = Number(day.slice(8, 10));
          return (
            <div
              key={i}
              className={`${compact ? "min-h-16" : "min-h-24"} border-b border-r border-slate-100 p-1`}
            >
              <div
                className={`mb-0.5 text-right text-[11px] ${isToday ? "font-bold text-sky-600" : "text-slate-400"}`}
              >
                {isToday ? <span className="rounded-full bg-sky-600 px-1.5 text-white">{dayNum}</span> : dayNum}
              </div>
              <div className="flex flex-col gap-0.5">
                {evs.slice(0, compact ? 3 : 5).map((e, j) => {
                  const isStart = e.start === day;
                  const icon = e.kind === "flight" ? "✈ " : e.kind === "activity" ? "• " : "";
                  const body = (
                    <div
                      title={e.label}
                      className="truncate rounded px-1 text-[10px] leading-4 font-medium sm:text-[11px]"
                      style={{
                        background: e.kind === "trip" ? e.color : `${e.color}22`,
                        color: e.kind === "trip" ? "#fff" : e.color,
                        borderLeft: e.kind === "stop" ? `3px solid ${e.color}` : undefined,
                      }}
                    >
                      {icon}
                      {isStart || dayNum === 1 || i % 7 === 0 || e.kind === "activity" || e.kind === "flight"
                        ? e.label
                        : " "}
                    </div>
                  );
                  return e.href ? (
                    <Link key={j} href={e.href} className="hover:opacity-80">
                      {body}
                    </Link>
                  ) : (
                    <div key={j}>{body}</div>
                  );
                })}
                {evs.length > (compact ? 3 : 5) && (
                  <div className="text-[10px] text-slate-400">+{evs.length - (compact ? 3 : 5)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Liefert alle Monate (year, month) zwischen zwei ISO-Daten */
export function monthsBetween(a: string, b: string): { year: number; month: number }[] {
  const s = parseDate(a)!;
  const e = parseDate(b)!;
  const out: { year: number; month: number }[] = [];
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth();
  while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) {
    out.push({ year: y, month: m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    if (out.length > 24) break;
  }
  return out;
}
