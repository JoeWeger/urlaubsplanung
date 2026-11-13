"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { listingFromHtml, scrapeListing, type ScrapedListing } from "@/lib/scrape";
import { authToken } from "@/lib/auth";
import { BOOKMARKLET_VERSION } from "@/lib/bookmarklet";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};
const n = (f: FormData, k: string) => {
  const v = s(f, k);
  if (v == null) return null;
  const x = parseFloat(v.replace(",", "."));
  return Number.isFinite(x) ? x : null;
};
const id = (f: FormData, k = "id") => Number(f.get(k));

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------- Login ---------- */
export async function login(_: unknown, f: FormData) {
  const pw = s(f, "password");
  if (!process.env.APP_PASSWORD || pw !== process.env.APP_PASSWORD) {
    return { error: "Falsches Passwort" };
  }
  (await cookies()).set("auth", await authToken(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  redirect(s(f, "next") || "/");
}

/* ---------- Trips ---------- */
export async function createTrip(f: FormData) {
  const rows = await query<{ id: number }>(
    "INSERT INTO trips (name, destination, start_date, end_date, color, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [s(f, "name") ?? "Neuer Urlaub", s(f, "destination"), s(f, "start_date"), s(f, "end_date"), s(f, "color") ?? "#0ea5e9", s(f, "notes")],
  );
  refresh();
  redirect(`/trips/${rows[0].id}`);
}

export async function updateTrip(f: FormData) {
  await query(
    "UPDATE trips SET name=$2, destination=$3, start_date=$4, end_date=$5, color=$6, notes=$7 WHERE id=$1",
    [id(f), s(f, "name") ?? "Urlaub", s(f, "destination"), s(f, "start_date"), s(f, "end_date"), s(f, "color") ?? "#0ea5e9", s(f, "notes")],
  );
  refresh();
}

export async function deleteTrip(f: FormData) {
  await query("DELETE FROM trips WHERE id=$1", [id(f)]);
  refresh();
  redirect("/");
}

/* ---------- Flights ---------- */
const flightFields = (f: FormData) => [
  s(f, "airline"),
  s(f, "flight_no"),
  s(f, "from_airport"),
  s(f, "to_airport"),
  s(f, "depart_at"),
  s(f, "arrive_at"),
  s(f, "booking_ref"),
  n(f, "price"),
  s(f, "link"),
  s(f, "notes"),
];

const MAX_FILE = 4 * 1024 * 1024;

async function saveFlightFiles(flightId: number, f: FormData) {
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  for (const file of files) {
    if (file.size > MAX_FILE) throw new Error(`${file.name} ist größer als 4 MB.`);
    const buf = Buffer.from(await file.arrayBuffer());
    await query("INSERT INTO flight_files (flight_id, filename, mime, size, data) VALUES ($1,$2,$3,$4,$5)", [
      flightId,
      file.name || "Dokument.pdf",
      file.type || "application/pdf",
      file.size,
      buf,
    ]);
  }
}

export async function createFlight(f: FormData) {
  const rows = await query<{ id: number }>(
    "INSERT INTO flights (trip_id, airline, flight_no, from_airport, to_airport, depart_at, arrive_at, booking_ref, price, link, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    [id(f, "trip_id"), ...flightFields(f)],
  );
  await saveFlightFiles(rows[0].id, f);
  refresh();
}

export async function uploadFlightFiles(f: FormData) {
  await saveFlightFiles(id(f), f);
  refresh();
}

export async function deleteFlightFile(f: FormData) {
  await query("DELETE FROM flight_files WHERE id=$1", [id(f)]);
  refresh();
}

export async function updateFlight(f: FormData) {
  await query(
    "UPDATE flights SET airline=$2, flight_no=$3, from_airport=$4, to_airport=$5, depart_at=$6, arrive_at=$7, booking_ref=$8, price=$9, link=$10, notes=$11 WHERE id=$1",
    [id(f), ...flightFields(f)],
  );
  await saveFlightFiles(id(f), f);
  refresh();
}

export async function deleteFlight(f: FormData) {
  await query("DELETE FROM flights WHERE id=$1", [id(f)]);
  refresh();
}

/* ---------- Stops ---------- */
export async function createStop(f: FormData) {
  await query(
    "INSERT INTO stops (trip_id, name, start_date, end_date, description) VALUES ($1,$2,$3,$4,$5)",
    [id(f, "trip_id"), s(f, "name") ?? "Neuer Stopp", s(f, "start_date"), s(f, "end_date"), s(f, "description")],
  );
  refresh();
}

export async function updateStop(f: FormData) {
  await query(
    "UPDATE stops SET name=$2, start_date=$3, end_date=$4, description=$5 WHERE id=$1",
    [id(f), s(f, "name") ?? "Stopp", s(f, "start_date"), s(f, "end_date"), s(f, "description")],
  );
  refresh();
}

export async function deleteStop(f: FormData) {
  const tripId = id(f, "trip_id");
  await query("DELETE FROM stops WHERE id=$1", [id(f)]);
  refresh();
  redirect(`/trips/${tripId}`);
}

/* ---------- Hotels ---------- */
export type ImportState = { ok?: boolean; error?: string; warning?: string } | null;

async function insertHotel(stopId: number, d: ScrapedListing) {
  const stop = (
    await query<{ start_date: string | null; end_date: string | null }>(
      "SELECT start_date, end_date FROM stops WHERE id=$1",
      [stopId],
    )
  )[0];
  const checkin = d.checkin ?? stop?.start_date ?? null;
  const checkout = d.checkout ?? stop?.end_date ?? null;
  let total = d.price_total;
  let perNight = d.price_per_night;
  const nn = checkin && checkout ? Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000) : 0;
  if (nn > 0) {
    if (total == null && perNight != null) total = Math.round(perNight * nn);
    if (perNight == null && total != null) perNight = Math.round((total / nn) * 100) / 100;
  }
  await query(
    `INSERT INTO hotels (stop_id, url, source, name, image, address, description, price_total, price_per_night, currency, rating, rating_scale, review_count, checkin, checkout, orig_price, orig_currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [stopId, d.url, d.source, d.name ?? new URL(d.url).hostname, d.image, d.address, d.description, total, perNight, d.currency ?? "EUR", d.rating, d.rating_scale, d.review_count, checkin, checkout, d.orig_price, d.orig_currency],
  );
}

/** Neue Daten in ein bestehendes Hotel übernehmen (leere Felder überschreiben nichts) */
async function applyListing(hotelId: number, d: ScrapedListing) {
  await query(
    `UPDATE hotels SET name=COALESCE($2,name), image=COALESCE($3,image), address=COALESCE($4,address), description=COALESCE($5,description),
       price_per_night=COALESCE($6,price_per_night), price_total=COALESCE($7,price_total), currency=COALESCE($8,currency),
       rating=COALESCE($9,rating), rating_scale=COALESCE($10,rating_scale), review_count=COALESCE($11,review_count),
       orig_price=CASE WHEN $7::float8 IS NULL THEN orig_price ELSE $12 END, orig_currency=CASE WHEN $7::float8 IS NULL THEN orig_currency ELSE $13 END,
       url=COALESCE($14,url) WHERE id=$1`,
    [hotelId, d.name, d.image, d.address, d.description, d.price_per_night, d.price_total, d.currency, d.rating, d.rating_scale, d.review_count, d.orig_price, d.orig_currency, d.url],
  );
}

export async function importHotel(_: ImportState, f: FormData): Promise<ImportState> {
  const stopId = id(f, "stop_id");
  const raw = s(f, "url");
  if (!raw) return { error: "Bitte einen Link einfügen." };
  let url: URL;
  try {
    url = new URL(raw.match(/https?:\/\/\S+/)?.[0] ?? raw);
  } catch {
    return { error: "Das ist kein gültiger Link." };
  }
  const d = await scrapeListing(url.toString());
  await insertHotel(stopId, d);
  refresh();
  return { ok: true, warning: d.warning };
}

/* ---------- Import per Lesezeichen (Daten kommen aus dem Browser des Nutzers) ---------- */
export type ImportPreview = {
  listing: ScrapedListing;
  stops: { id: number; name: string; trip: string; start_date: string | null; end_date: string | null }[];
  suggestedStop: number | null;
  existing: { id: number; stop_id: number; name: string | null; stop: string }[];
  outdated: boolean;
  debug: string;
};

const pathKey = (u: string) => {
  try {
    const x = new URL(u);
    return x.hostname.replace(/^www\./, "").replace(/^[a-z]{2}\./, "") + x.pathname.replace(/\.[a-z-]+\.html$/, "");
  } catch {
    return u;
  }
};

export async function previewImport(url: string, html: string): Promise<ImportPreview> {
  const listing = await listingFromHtml(url, html.slice(0, 500_000));
  const stops = await query<ImportPreview["stops"][number]>(
    `SELECT s.id, s.name, t.name AS trip, s.start_date, s.end_date FROM stops s JOIN trips t ON t.id=s.trip_id
     WHERE t.end_date IS NULL OR t.end_date >= to_char(now() - interval '30 days','YYYY-MM-DD')
     ORDER BY t.start_date NULLS LAST, s.start_date NULLS LAST, s.id`,
  );
  const ci = listing.checkin;
  const suggested =
    (ci && stops.find((x) => x.start_date && x.end_date && x.start_date <= ci && ci < x.end_date)?.id) || null;
  const all = await query<{ id: number; stop_id: number; name: string | null; url: string | null; stop: string }>(
    "SELECT h.id, h.stop_id, h.name, h.url, s.name AS stop FROM hotels h JOIN stops s ON s.id=h.stop_id",
  );
  const key = pathKey(listing.url);
  const existing = all.filter((h) => h.url && pathKey(h.url) === key).map(({ url: _u, ...rest }) => rest);
  const metaVal = (n: string) => {
    const m = html.match(new RegExp(`<meta name="${n}" content="([^"]*)"`));
    return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&") : "";
  };
  const outdated = Number(metaVal("x-bm") || 0) < BOOKMARKLET_VERSION;
  const debug = [
    `Lesezeichen-Version: ${metaVal("x-bm") || "alt"}`,
    `og:title: ${html.match(/og:title" content="([^"]*)"/)?.[1] ?? "–"}`,
    `Bewertung: ${metaVal("x-review") || "–"}`,
    `Preisbereich: ${metaVal("x-price") || "–"}`,
    `Seitentext:\n${metaVal("x-text").slice(0, 5000) || "–"}`,
  ].join("\n\n");
  return { listing, stops, suggestedStop: suggested, existing, outdated, debug };
}

export async function saveImport(f: FormData) {
  const url = s(f, "url");
  const html = String(f.get("html") ?? "");
  if (!url) return;
  const d = await listingFromHtml(url, html.slice(0, 500_000));
  const existingId = Number(f.get("existing_id") || 0);
  let stopId = id(f, "stop_id");
  if (existingId) {
    await applyListing(existingId, d);
    stopId = (await query<{ stop_id: number }>("SELECT stop_id FROM hotels WHERE id=$1", [existingId]))[0]?.stop_id ?? stopId;
  } else {
    await insertHotel(stopId, d);
  }
  const trip = (await query<{ trip_id: number }>("SELECT trip_id FROM stops WHERE id=$1", [stopId]))[0];
  refresh();
  redirect(trip ? `/trips/${trip.trip_id}/stops/${stopId}` : "/");
}

export async function updateHotel(f: FormData) {
  const checkin = s(f, "checkin");
  const checkout = s(f, "checkout");
  let total = n(f, "price_total");
  let perNight = n(f, "price_per_night");
  const nn = checkin && checkout ? Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000) : 0;
  if (nn > 0) {
    if (total == null && perNight != null) total = Math.round(perNight * nn);
    if (perNight == null && total != null) perNight = Math.round((total / nn) * 100) / 100;
  }
  await query(
    `UPDATE hotels SET orig_price = CASE WHEN price_total IS DISTINCT FROM $6 THEN NULL ELSE orig_price END,
       orig_currency = CASE WHEN price_total IS DISTINCT FROM $6 THEN NULL ELSE orig_currency END,
       name=$2, url=$3, image=$4, address=$5, price_total=$6, price_per_night=$7, currency=$8, rating=$9, rating_scale=$10, review_count=$11, checkin=$12, checkout=$13, notes=$14, description=$15 WHERE id=$1`,
    [id(f), s(f, "name"), s(f, "url"), s(f, "image"), s(f, "address"), total, perNight, s(f, "currency") ?? "EUR", n(f, "rating"), n(f, "rating_scale"), n(f, "review_count"), checkin, checkout, s(f, "notes"), s(f, "description")],
  );
  refresh();
}

export async function setHotelStatus(f: FormData) {
  const status = s(f, "status") ?? "shortlist";
  if (status === "booked") {
    // Pro Stopp nur ein gebuchtes Hotel
    await query(
      "UPDATE hotels SET status='shortlist' WHERE stop_id=(SELECT stop_id FROM hotels WHERE id=$1) AND status='booked'",
      [id(f)],
    );
  }
  await query("UPDATE hotels SET status=$2 WHERE id=$1", [id(f), status]);
  refresh();
}

export async function refreshHotel(f: FormData) {
  const rows = await query<{ url: string | null }>("SELECT url FROM hotels WHERE id=$1", [id(f)]);
  const url = rows[0]?.url;
  if (!url) return;
  await applyListing(id(f), await scrapeListing(url));
  refresh();
}

export async function deleteHotel(f: FormData) {
  await query("DELETE FROM hotels WHERE id=$1", [id(f)]);
  refresh();
}

/* ---------- Activities ---------- */
const activityFields = (f: FormData) => [
  s(f, "title") ?? "Aktivität",
  s(f, "date"),
  s(f, "time"),
  s(f, "description"),
  s(f, "link"),
  n(f, "cost"),
];

export async function createActivity(f: FormData) {
  await query(
    "INSERT INTO activities (stop_id, title, date, time, description, link, cost) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id(f, "stop_id"), ...activityFields(f)],
  );
  refresh();
}

export async function updateActivity(f: FormData) {
  await query(
    "UPDATE activities SET title=$2, date=$3, time=$4, description=$5, link=$6, cost=$7 WHERE id=$1",
    [id(f), ...activityFields(f)],
  );
  refresh();
}

export async function toggleActivity(f: FormData) {
  await query("UPDATE activities SET done = NOT done WHERE id=$1", [id(f)]);
  refresh();
}

export async function deleteActivity(f: FormData) {
  await query("DELETE FROM activities WHERE id=$1", [id(f)]);
  refresh();
}
