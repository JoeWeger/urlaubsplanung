import { addDays } from "./format";

export type Gap = { start: string; end: string; nights: number };

/**
 * Findet Nächte im Reisezeitraum, die keinem Stopp zugeordnet sind.
 * Eine Nacht d ist belegt, wenn ein Stopp mit start <= d < end existiert.
 * Ergebnis: zusammenhängende Lücken (end = Tag nach der letzten offenen Nacht).
 */
export function findGaps(
  tripStart: string | null,
  tripEnd: string | null,
  stops: { start_date: string | null; end_date: string | null }[],
): Gap[] {
  if (!tripStart || !tripEnd || tripEnd <= tripStart) return [];
  const ranges = stops
    .filter((s) => s.start_date)
    .map((s) => ({
      start: s.start_date!,
      end: s.end_date && s.end_date > s.start_date! ? s.end_date : addDays(s.start_date!, 1),
    }));
  const gaps: Gap[] = [];
  let cur: Gap | null = null;
  for (let d = tripStart; d < tripEnd; d = addDays(d, 1)) {
    const covered = ranges.some((r) => r.start <= d && d < r.end);
    if (!covered) {
      if (cur) {
        cur.end = addDays(d, 1);
        cur.nights++;
      } else {
        cur = { start: d, end: addDays(d, 1), nights: 1 };
        gaps.push(cur);
      }
    } else {
      cur = null;
    }
  }
  return gaps;
}
