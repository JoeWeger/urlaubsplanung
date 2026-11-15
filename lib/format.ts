export function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return null;
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso)!;
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

export function nightsBetween(a?: string | null, b?: string | null): number | null {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return null;
  const n = Math.round((db.getTime() - da.getTime()) / 86400000);
  return n > 0 ? n : null;
}

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function fmtDate(d?: string | null): string {
  const p = parseDate(d);
  return p ? dateFmt.format(p) : "–";
}

export function fmtShort(d?: string | null): string {
  const p = parseDate(d);
  return p ? shortFmt.format(p) : "–";
}

export function fmtRange(a?: string | null, b?: string | null): string {
  if (!a && !b) return "Kein Datum";
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}

export function fmtDateTime(dt?: string | null): string {
  if (!dt) return "–";
  const [d, t] = dt.split("T");
  return `${fmtDate(d)}${t ? `, ${t.slice(0, 5)} Uhr` : ""}`;
}

export function fmtMoney(v?: number | null, currency?: string | null): string {
  if (v == null || Number.isNaN(v)) return "–";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${Math.round(v)} ${currency ?? ""}`;
  }
}

/** Bewertung auf 10er-Skala normalisieren (Airbnb = 5er, Booking = 10er) */
export function rating10(r?: number | null, scale?: number | null): number | null {
  if (r == null) return null;
  const s = scale || (r <= 5 ? 5 : 10);
  return (r / s) * 10;
}

export function sourceLabel(s?: string | null): string {
  switch (s) {
    case "booking":
      return "Booking.com";
    case "airbnb":
      return "Airbnb";
    case "expedia":
      return "Expedia";
    case "hotels":
      return "Hotels.com";
    case "getyourguide":
      return "GetYourGuide";
    case "viator":
      return "Viator";
    case "tripadvisor":
      return "Tripadvisor";
    case "klook":
      return "Klook";
    case "tiqets":
      return "Tiqets";
    case "musement":
      return "Musement";
    case "civitatis":
      return "Civitatis";
    default:
      return s ? s : "Link";
  }
}

export function hostOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Alte, knallige Reisefarben auf die neue, erdige Palette abbilden */
const LEGACY_COLORS: Record<string, string> = {
  "#0ea5e9": "#2f6a8a",
  "#f97316": "#c2603a",
  "#10b981": "#2e6553",
  "#8b5cf6": "#7a4e6d",
  "#ef4444": "#c06b77",
  "#eab308": "#b8892f",
  "#ec4899": "#c06b77",
  "#14b8a6": "#6f8a5c",
};

export function tripColor(c?: string | null): string {
  if (!c) return "#2e6553";
  return LEGACY_COLORS[c.toLowerCase()] ?? c;
}
