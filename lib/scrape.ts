/**
 * Liest Infos (Name, Preis, Bewertung, Bild …) aus Booking.com-, Airbnb- und
 * sonstigen Unterkunfts-Links aus. Best effort: Die Plattformen ändern ihr HTML
 * regelmäßig und blockieren teils Server-Anfragen – dann wird so viel wie
 * möglich aus der URL selbst gewonnen und der Rest kann manuell ergänzt werden.
 */

export type ScrapedListing = {
  url: string;
  source: string;
  name: string | null;
  image: string | null;
  address: string | null;
  description: string | null;
  price_total: number | null;
  price_per_night: number | null;
  currency: string | null;
  rating: number | null;
  rating_scale: number | null;
  review_count: number | null;
  checkin: string | null;
  checkout: string | null;
  orig_price: number | null;
  orig_currency: string | null;
  duration?: string | null;
  fetched: boolean;
  warning?: string;
};

export function detectSource(url: URL): string {
  const h = url.hostname;
  if (h.includes("booking.")) return "booking";
  if (h.includes("airbnb.")) return "airbnb";
  if (h.includes("expedia.")) return "expedia";
  if (h.includes("hotels.com")) return "hotels";
  if (h.includes("agoda.")) return "agoda";
  if (h.includes("vrbo.")) return "vrbo";
  if (h.includes("getyourguide.")) return "getyourguide";
  if (h.includes("viator.")) return "viator";
  if (h.includes("tripadvisor.")) return "tripadvisor";
  if (h.includes("klook.")) return "klook";
  if (h.includes("tiqets.")) return "tiqets";
  if (h.includes("musement.")) return "musement";
  if (h.includes("civitatis.")) return "civitatis";
  return h.replace(/^www\./, "");
}

const ACTIVITY_SOURCES = ["getyourguide", "viator", "tripadvisor", "klook", "tiqets", "musement", "civitatis"];

/** Link zeigt auf eine Aktivität/Tour statt auf eine Unterkunft? */
export function isActivityUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const src = detectSource(u);
    if (ACTIVITY_SOURCES.includes(src)) return true;
    return src === "airbnb" && /\/experiences\//.test(u.pathname);
  } catch {
    return false;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function meta(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Wert in "…" darf Apostrophe enthalten (z. B. "15 minutes' walk") und umgekehrt
  const val = `(?:"([^"]*)"|'([^']*)')`;
  const re1 = new RegExp(`<meta[^>]+?(?:property|name|itemprop)=["']${k}["'][^>]*?content=${val}`, "i");
  const re2 = new RegExp(`<meta[^>]+?content=${val}[^>]*?(?:property|name|itemprop)=["']${k}["']`, "i");
  const m = html.match(re1) || html.match(re2);
  const v = m ? (m[1] ?? m[2]) : null;
  return v != null ? decodeEntities(v).trim() || null : null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d.,]/g, "");
  if (!s) return null;
  // "1.234,56" / "1,234.56" / "123,5"
  let n: string;
  if (s.includes(",") && s.includes(".")) {
    n = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    n = /,\d{3}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else {
    n = /\.\d{3}$/.test(s) && s.split(".").length > 1 && s.length > 4 ? s.replace(/\./g, "") : s;
  }
  const f = parseFloat(n);
  return Number.isFinite(f) ? f : null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "CA$": "CAD",
  "C$": "CAD",
  "US$": "USD",
  "£": "GBP",
  "CHF": "CHF",
  "¥": "JPY",
};

function parsePriceText(text: string): { amount: number; currency: string | null } | null {
  const m =
    text.match(/(CA\$|C\$|US\$|€|\$|£|CHF|EUR|USD|CAD|GBP)\s?([\d.,]+\d)/) ||
    text.match(/([\d.,]+\d)\s?(€|EUR|USD|CAD|GBP|CHF|\$)/);
  if (!m) return null;
  const [a, b] = /\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
  const amount = num(a);
  if (amount == null) return null;
  const currency = CURRENCY_SYMBOLS[b] || (b.length === 3 ? b : null);
  return { amount, currency };
}

type JsonLd = Record<string, unknown>;

function collectJsonLd(html: string): JsonLd[] {
  const out: JsonLd[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const item = stack.shift();
        if (!item || typeof item !== "object") continue;
        out.push(item as JsonLd);
        const g = (item as JsonLd)["@graph"];
        if (Array.isArray(g)) stack.push(...g);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

const LODGING_TYPES = /Hotel|Lodging|Accommodation|Resort|Hostel|Motel|BedAndBreakfast|VacationRental|Apartment|House|Product|Place/i;

function pickLodging(items: JsonLd[]): JsonLd | null {
  const withType = items.filter((i) => {
    const t = i["@type"];
    const ts = Array.isArray(t) ? t.join(" ") : String(t ?? "");
    return LODGING_TYPES.test(ts);
  });
  return (
    withType.find((i) => i.aggregateRating) ||
    withType[0] ||
    items.find((i) => i.aggregateRating) ||
    null
  );
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return decodeEntities(v).trim() || null;
  if (Array.isArray(v)) return str(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return str(o.url ?? o.contentUrl ?? o.name ?? null);
  }
  return String(v);
}

function addressStr(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const a = v as Record<string, unknown>;
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const out: string[] = [];
  for (const raw of [a.streetAddress, a.postalCode, a.addressLocality, a.addressRegion, a.addressCountry]) {
    const p = typeof raw === "object" && raw ? str((raw as Record<string, unknown>).name) : str(raw);
    // Booking liefert oft schon "Straße, Viertel, PLZ Ort, Land" in streetAddress → nichts doppelt anhängen
    if (p && !norm(out.join(", ")).includes(norm(p))) out.push(p);
  }
  return out.length ? out.join(", ") : null;
}

/** Name aus der URL ableiten, falls die Seite nicht geladen werden kann */
function nameFromUrl(url: URL, source: string): string | null {
  if (source === "booking") {
    const m = url.pathname.match(/\/hotel\/[a-z]{2}\/([^./]+)/i);
    if (m) {
      return m[1]
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  if (source === "airbnb") {
    const m = url.pathname.match(/\/rooms\/(?:plus\/)?(\d+)/);
    if (m) return `Airbnb #${m[1]}`;
  }
  if (ACTIVITY_SOURCES.includes(source)) {
    // z. B. /montreal-l1131/old-montreal-food-tour-t12345/ → "Old Montreal Food Tour"
    const seg = url.pathname.split("/").filter(Boolean).reverse().find((p) => /[a-z]-[a-z]/i.test(p) && !/^[a-z]{2}(-[a-z]{2})?$/i.test(p));
    if (seg) {
      const words = seg.replace(/\.html?$/, "").replace(/-[a-z]?\d+$/i, "").replace(/^[a-z]?\d+-/i, "").split("-").filter(Boolean);
      if (words.length) return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return null;
}

function datesFromUrl(url: URL) {
  const p = url.searchParams;
  const ci = p.get("checkin") || p.get("check_in") || p.get("startDate") || p.get("chkin");
  const co = p.get("checkout") || p.get("check_out") || p.get("endDate") || p.get("chkout");
  const ok = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
  // Booking alt-Format: checkin_year/checkin_month/checkin_monthday
  const legacy = (pre: string) => {
    const y = p.get(`${pre}_year`);
    const mo = p.get(`${pre}_month`);
    const d = p.get(`${pre}_monthday`);
    return y && mo && d ? `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
  };
  return {
    checkin: ok(ci) || legacy("checkin"),
    checkout: ok(co) || legacy("checkout"),
  };
}

function nights(ci: string | null, co: string | null): number | null {
  if (!ci || !co) return null;
  const n = Math.round((Date.parse(co) - Date.parse(ci)) / 86400000);
  return n > 0 ? n : null;
}

const PRICE_RE = /(CA\$|C\$|US\$|€|EUR|\$|£|CHF)\s?(\d[\d.,]*\d|\d)|(\d[\d.,]*\d|\d)\s?(€|EUR|CA\$|\$|CHF)/g;

/** Sucht im sichtbaren Text nach Gesamtpreis bzw. Preis pro Nacht (Airbnb/Booking, de/en) */
export function pricesFromText(raw: string): {
  total: { amount: number; currency: string | null } | null;
  perNight: { amount: number; currency: string | null } | null;
} {
  const text = raw.replace(/[   ]/g, " ");
  type P = { amount: number; currency: string | null } | null;
  let gesamt: P = null;
  let forNights: P = null;
  let perNight: P = null;
  for (const m of text.matchAll(PRICE_RE)) {
    const amount = num(m[2] ?? m[3]);
    if (amount == null || amount < 5) continue;
    const sym = m[1] ?? m[4];
    const currency = CURRENCY_SYMBOLS[sym] || (sym.length === 3 ? sym : null);
    const before = text.slice(Math.max(0, m.index! - 40), m.index!);
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 40);
    const val = { amount, currency };
    if (/(Gesamtbetrag|Gesamtpreis|Gesamtsumme|Gesamt|Total)[^€$\d]{0,30}$/i.test(before)) {
      gesamt = val; // letzter Treffer = Endbetrag inkl. Gebühren
    } else if (/^\s*(?:[A-Z]{3}\s*)?(insgesamt|gesamt|total|in total|(für|for)\s*\d+\s*(Nächte|Nacht|nights?))/i.test(after)) {
      forNights ??= val;
    } else if (!perNight && /^\s*(\/\s*|pro\s+|per\s+)?(Nacht|night)\b/i.test(after)) {
      perNight = val;
    }
  }
  return { total: gesamt ?? forNights, perNight };
}

/**
 * Booking-Hotelseite (sichtbarer Text): Gesamtpreis für die gewählten Daten.
 * 1) "Ihre Suchdaten € 124" in der Preis-Vergleichsleiste
 * 2) Erste Zeile der Zimmertabelle nach "Preis für N Nächte" / "Der Preis heute"
 *    (bei "€ 146 € 124" ist der zweite Wert der aktuelle Preis)
 */
export function bookingPriceFromText(raw: string): { amount: number; currency: string | null } | null {
  const text = raw.replace(/[   ]/g, " ");
  const tokenAfter = (from: number, span: number) => {
    const slice = text.slice(from, from + span);
    const re = new RegExp(PRICE_RE.source, "g");
    const toks: { amount: number; currency: string | null; idx: number; end: number }[] = [];
    for (const m of slice.matchAll(re)) {
      const amount = num(m[2] ?? m[3]);
      const sym = m[1] ?? m[4];
      if (amount == null || amount < 5) continue;
      toks.push({ amount, currency: CURRENCY_SYMBOLS[sym] || (sym.length === 3 ? sym : null), idx: m.index!, end: m.index! + m[0].length });
    }
    return toks;
  };
  const search = text.search(/Ihre Suchdaten|Your search dates|Deine Suchdaten/i);
  if (search >= 0) {
    const t = tokenAfter(search, 60)[0];
    if (t) return { amount: t.amount, currency: t.currency };
  }
  const head = text.search(/Preis für \d+ N(ä|ae)chte?|Der Preis heute|Price for \d+ nights?|Today'?s price/i);
  if (head >= 0) {
    const toks = tokenAfter(head, 900);
    if (toks.length) {
      // durchgestrichener Preis direkt gefolgt vom aktuellen Preis
      if (toks[1] && toks[1].idx - toks[0].end < 12) return { amount: toks[1].amount, currency: toks[1].currency };
      return { amount: toks[0].amount, currency: toks[0].currency };
    }
  }
  return null;
}

export function parseListingHtml(html: string, url: URL): Partial<ScrapedListing> {
  const source = detectSource(url);
  const ld = pickLodging(collectJsonLd(html));
  const r: Partial<ScrapedListing> = {};

  const ogTitle = meta(html, "og:title") || meta(html, "twitter:title");
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  r.name =
    str(ld?.name) ||
    ogTitle?.split(/ · | \| /)[0] ||
    (titleTag ? decodeEntities(titleTag).split(/ – | - | \| /)[0].trim() : null) ||
    null;
  const h1 = meta(html, "x-h1");
  if (h1 && (!r.name || source === "airbnb")) r.name = h1;
  r.image =
    str(ld?.image) || str(ld?.photo) || meta(html, "og:image") || meta(html, "twitter:image") || meta(html, "x-img") || meta(html, "x-img2");
  r.address = addressStr(ld?.address) || meta(html, "x-address");

  // Dauer (Touren/Aktivitäten), z. B. "Dauer: 3 Stunden" / "Duration 2.5 hours"
  const durText = meta(html, "x-text") ?? html.replace(/<[^>]+>/g, " ");
  const dur = durText.match(
    /(?:Dauer|Duration)\s*:?\s*((?:\d+(?:[.,]\d+)?\s*(?:[-–]|bis|to)\s*)?\d+(?:[.,]\d+)?\s*(?:Stunden?|Std\.?|Minuten|Min\.?|Tage?|hours?|hrs?|minutes?|mins?|days?))/i,
  );
  if (dur) r.duration = dur[1].replace(/\s+/g, " ").trim();
  r.description =
    meta(html, "og:description") || meta(html, "description") || str(ld?.description);
  if (r.description && r.description.length > 400) r.description = r.description.slice(0, 397) + "…";

  // Bewertung
  const agg = ld?.aggregateRating as Record<string, unknown> | undefined;
  if (agg) {
    r.rating = num(agg.ratingValue);
    r.rating_scale = num(agg.bestRating) || (source === "booking" ? 10 : null);
    r.review_count = num(agg.reviewCount ?? agg.ratingCount) as number | null;
  }

  if (source === "airbnb") {
    // og:title z. B. "Wohnung in Montréal · ★4,92 · 1 Schlafzimmer · 1 Bett"
    const star = (ogTitle || titleTag || "").match(/★\s?([\d.,]+)/);
    if (r.rating == null && star) r.rating = num(star[1]);
    r.rating_scale = 5;
    if (r.rating == null) {
      const m = html.match(/"(?:guestSatisfactionOverall|starRating|avgRating|overallRating)"\s*:\s*"?([\d.]+)/);
      if (m) r.rating = num(m[1]);
    }
    if (r.review_count == null) {
      const m = html.match(/"(?:reviewCount|visibleReviewCount|reviewsCount)"\s*:\s*"?(\d+)/);
      if (m) r.review_count = Number(m[1]);
    }
    const rv = meta(html, "x-review");
    if (rv) {
      if (r.rating == null) {
        const m = rv.match(/(\d[,.]\d{1,2})/);
        if (m) r.rating = num(m[1]);
      }
      if (r.review_count == null) {
        const m = rv.match(/(\d[\d.]*)\s*(?:Bewertungen|Bewertung|reviews|review)/i);
        if (m) r.review_count = num(m[1]) as number | null;
      }
    }
    const txt = meta(html, "x-text");
    if (txt) {
      if (r.rating == null) {
        const m =
          txt.match(/★\s?(\d[,.]\d{1,2})/) ||
          txt.match(/(\d[,.]\d{1,2})\s*(?:·|\n)?\s*\d[\d.]*\s*(?:Bewertungen|reviews)/i) ||
          txt.match(/(?:Gästefavorit|Guest favou?rite)[\s\S]{0,200}?\b([1-5][,.]\d{1,2})\b/i);
        if (m) r.rating = num(m[1]);
      }
      if (r.review_count == null) {
        const m = txt.match(/(\d[\d.]*)\s*(?:Bewertungen|reviews)\b/i);
        if (m) r.review_count = num(m[1]) as number | null;
      }
    }
    // Airbnb-Titel enthalten oft nur die Kategorie; besseren Namen aus JSON suchen
    const listingName = html.match(/"listingTitle"\s*:\s*"([^"]{4,120})"/);
    if ((!r.name || /^(Wohnung|Unterkunft|Rental unit|Home|Condo|Loft|Haus)\b/i.test(r.name)) && listingName) {
      r.description = r.description || r.name || null;
      r.name = decodeEntities(listingName[1]);
    }
  }

  if (source === "booking") {
    const reviewText = meta(html, "x-review");
    if (r.rating == null && reviewText) {
      const m = reviewText.match(/(\d{1,2}[,.]\d)/);
      if (m) r.rating = num(m[1]);
    }
    if (r.rating == null) {
      const m = html.match(/data-review-score=["']([\d.,]+)/) ||
        html.match(/"reviewScore"\s*:\s*"?([\d.]+)/) ||
        html.match(/Bewertet mit ([\d,]+)|Scored ([\d.]+)/);
      if (m) r.rating = num(m[1] ?? m[2]);
      r.rating_scale = 10;
    }
    if (r.review_count == null) {
      const m = html.match(/"reviewCount"\s*:\s*"?(\d+)/) || html.match(/([\d.]+)\s+(?:Bewertungen|reviews)/i);
      if (m) r.review_count = num(m[1]) as number | null;
    }
  }

  // Preis
  const offers = (ld?.offers ?? (ld as Record<string, unknown> | null)?.makesOffer) as unknown;
  const offer = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown> | undefined;
  let price: number | null = null;
  let currency: string | null = null;
  if (offer) {
    price = num(offer.price ?? offer.lowPrice ?? (offer.priceSpecification as Record<string, unknown> | undefined)?.price);
    currency = str(offer.priceCurrency) ?? null;
  }
  if (price == null) {
    const amt = meta(html, "product:price:amount") || meta(html, "og:price:amount");
    if (amt) {
      price = num(amt);
      currency = meta(html, "product:price:currency") || meta(html, "og:price:currency");
    }
  }
  if (price == null && typeof ld?.priceRange === "string") {
    const p = parsePriceText(ld.priceRange);
    if (p) {
      price = p.amount;
      currency = p.currency;
    }
  }
  if (price == null && source === "airbnb") {
    const m = html.match(/"(?:priceString|discountedPrice)"\s*:\s*"([^"]*\d[^"]*)"/);
    const p = m ? parsePriceText(decodeEntities(m[1])) : null;
    if (p) {
      price = p.amount;
      currency = p.currency;
    }
  }

  // Preis aus dem sichtbaren Buchungsbereich (nur per Lesezeichen verfügbar)
  let totalFromPage: number | null = null;
  if (source === "booking") {
    const t = meta(html, "x-text");
    const b = t ? bookingPriceFromText(t) : null;
    if (b) {
      totalFromPage = b.amount;
      currency = b.currency ?? currency;
    }
  }
  for (const priceText of [meta(html, "x-price"), source === "airbnb" ? meta(html, "x-text") : null]) {
    if (!priceText || totalFromPage != null) continue;
    const found = pricesFromText(priceText);
    if (found.total) {
      totalFromPage = found.total.amount;
      currency = currency ?? found.total.currency;
    } else if (price == null && found.perNight) {
      price = found.perNight.amount;
      currency = found.perNight.currency;
    }
  }
  if (totalFromPage != null) {
    r.price_total = totalFromPage;
    r.price_per_night = null;
    r.currency = currency || null;
  }

  if (price != null) {
    // priceRange bei Booking ist in der Regel "ab X pro Nacht"
    r.price_per_night = price;
    r.currency = currency || null;
  }
  return r;
}

import { currencyForCountry, getRate } from "./currency";

/**
 * Booking.com schreibt den Preis des gewählten Zimmers direkt in den Link:
 *   sr_pri_blocks=<blockId>__<Preis in Cent>  (bei sb_price_type=total = Gesamtpreis)
 * Mehrere Zimmer sind durch Komma getrennt. Der Betrag ist in der Landeswährung
 * des Hotels (z. B. CAD bei /hotel/ca/…), nicht in der Anzeigewährung.
 */
export function bookingPriceFromUrl(url: URL): { total: number; currency: string } | null {
  const p = url.searchParams;
  const raw = p.get("sr_pri_blocks") || p.get("pri_blocks");
  if (!raw) return null;
  let cents = 0;
  for (const block of raw.split(",")) {
    const m = block.match(/__(\d+)$/);
    if (m) cents += Number(m[1]);
  }
  if (!cents) return null;
  const cc = url.pathname.match(/\/hotel\/([a-z]{2})\//i)?.[1];
  return { total: cents / 100, currency: currencyForCountry(cc) ?? "EUR" };
}

/** Tracking-Parameter entfernen – nur was für die Seite relevant ist */
function cleanUrl(url: URL, source: string): URL {
  if (source !== "booking") return url;
  const keep = ["checkin", "checkout", "group_adults", "group_children", "no_rooms", "selected_currency"];
  const u = new URL(url.origin + url.pathname);
  for (const k of keep) {
    const v = url.searchParams.get(k);
    if (v) u.searchParams.set(k, v);
  }
  u.searchParams.set("lang", "de");
  return u;
}

function looksBlocked(status: number, html: string): boolean {
  if (status === 202 || status === 403 || status === 429) return true;
  const hasData = /og:title|application\/ld\+json/i.test(html);
  return !hasData && /captcha|challenge|AwsWaf|Access Denied|px-captcha|bot/i.test(html);
}

async function fetchHtml(target: URL): Promise<{ status: number; html: string; finalUrl: string }> {
  // Optional: Scraping-Dienst, falls die Plattform Server-Anfragen blockiert,
  // z. B. SCRAPE_PROXY_URL="https://api.scraperapi.com/?api_key=KEY&country_code=de&url={url}"
  const tpl = process.env.SCRAPE_PROXY_URL;
  const fetchUrl = tpl ? tpl.replace("{url}", encodeURIComponent(target.toString())) : target.toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), tpl ? 45000 : 12000);
  try {
    const res = await fetch(fetchUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: tpl
        ? {}
        : {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
          },
    });
    const html = await res.text();
    return { status: res.status, html, finalUrl: tpl ? target.toString() : res.url || target.toString() };
  } finally {
    clearTimeout(t);
  }
}

type Prepared = { url: URL; source: string; base: ScrapedListing; urlPrice: { total: number; currency: string } | null; n: number | null };

async function prepare(rawUrl: string): Promise<Prepared> {
  const url = new URL(rawUrl.trim());
  const source = detectSource(url);
  const { checkin, checkout } = datesFromUrl(url);
  const n = nights(checkin, checkout);
  const urlPriceRaw = source === "booking" ? bookingPriceFromUrl(url) : null;
  // In Euro umrechnen (Booking zeigt ebenfalls umgerechnete Preise)
  let urlPrice: { total: number; currency: string } | null = urlPriceRaw;
  if (urlPriceRaw && urlPriceRaw.currency !== "EUR") {
    const rate = await getRate(urlPriceRaw.currency, "EUR");
    if (rate) urlPrice = { total: urlPriceRaw.total * rate, currency: "EUR" };
  }
  const base: ScrapedListing = {
    url: url.toString(),
    source,
    name: nameFromUrl(url, source),
    image: null,
    address: null,
    description: null,
    price_total: urlPrice ? Math.round(urlPrice.total) : null,
    price_per_night: urlPrice && n ? Math.round((urlPrice.total / n) * 100) / 100 : null,
    currency: urlPrice?.currency ?? null,
    orig_price: urlPriceRaw && urlPriceRaw.currency !== urlPrice?.currency ? urlPriceRaw.total : null,
    orig_currency: urlPriceRaw && urlPriceRaw.currency !== urlPrice?.currency ? urlPriceRaw.currency : null,
    rating: null,
    rating_scale: source === "airbnb" || ACTIVITY_SOURCES.includes(source) ? 5 : source === "booking" ? 10 : null,
    review_count: null,
    checkin,
    checkout,
    fetched: false,
  };
  return { url, source, base, urlPrice, n };
}

function merge(p: Prepared, parsed: Partial<ScrapedListing>): ScrapedListing {
  const merged: ScrapedListing = { ...p.base, fetched: true };
  // Gesamtpreis direkt von der Seite (so wie Booking/Airbnb ihn dir anzeigen) ist am genauesten
  const pageTotal = parsed.price_total != null;
  for (const [k, v] of Object.entries(parsed)) {
    if (v == null || v === "") continue;
    // Sonst: Preis aus dem Link (gewähltes Zimmer + Daten) ist genauer als "ab"-Preise der Seite
    if (!pageTotal && p.urlPrice && (k === "price_per_night" || k === "currency")) continue;
    (merged as Record<string, unknown>)[k] = v;
  }
  if (pageTotal) {
    merged.orig_price = null;
    merged.orig_currency = null;
    merged.price_per_night = p.n ? Math.round((merged.price_total! / p.n) * 100) / 100 : null;
  }
  if (merged.price_total == null && merged.price_per_night != null && p.n) {
    merged.price_total = Math.round(merged.price_per_night * p.n);
  }
  return merged;
}

const missing = (r: ScrapedListing) =>
  [
    r.price_total == null && r.price_per_night == null ? "Preis" : null,
    r.rating == null ? "Bewertung" : null,
    r.image == null ? "Foto" : null,
  ]
    .filter(Boolean)
    .join(", ");

/** Daten, die das Lesezeichen direkt aus dem Browser des Nutzers schickt */
export async function listingFromHtml(rawUrl: string, html: string): Promise<ScrapedListing> {
  const p = await prepare(rawUrl);
  const merged = merge(p, parseListingHtml(html, p.url));
  const m = missing(merged);
  if (m) merged.warning = `${m} nicht gefunden – bitte unter „Details bearbeiten“ ergänzen.`;
  return merged;
}

/** Fallback: kostenloser Vorschau-Dienst (Microlink) für Foto/Titel, wenn die Seite blockiert */
async function microlink(target: URL): Promise<Partial<ScrapedListing> | null> {
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(target.toString())}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      status?: string;
      data?: { title?: string; description?: string; image?: { url?: string } };
    };
    if (j.status !== "success" || !j.data) return null;
    const out: Partial<ScrapedListing> = {};
    const img = j.data.image?.url;
    if (img && /^https?:/.test(img) && !/(^|\.)(booking\.com|airbnb\.[a-z.]+)$/i.test(new URL(img).hostname)) out.image = img;
    const title = j.data.title?.trim();
    if (title && !/booking\.com|airbnb|challenge|captcha|access denied|just a moment/i.test(title)) {
      out.name = title.split(/ · | \| | – | - /)[0].trim();
      if (j.data.description) out.description = j.data.description.slice(0, 400);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function scrapeListing(rawUrl: string): Promise<ScrapedListing> {
  const p = await prepare(rawUrl);
  const target = cleanUrl(p.url, p.source);
  let blocked = false;
  try {
    const { status, html, finalUrl } = await fetchHtml(target);
    if (looksBlocked(status, html) || status >= 400) {
      blocked = true;
    } else {
      const merged = merge(p, parseListingHtml(html, new URL(finalUrl)));
      const m = missing(merged);
      if (m) merged.warning = `${m} nicht gefunden – bitte unter „Details bearbeiten“ ergänzen.`;
      return merged;
    }
  } catch {
    blocked = true;
  }

  // Seite blockiert → Vorschau-Dienst versuchen
  const extra = blocked ? await microlink(target) : null;
  const result: ScrapedListing = extra ? { ...merge(p, extra), fetched: false } : p.base;
  const m = missing(result);
  if (m) {
    result.warning = `${sourceName(p.source)} blockiert die automatische Abfrage – ${m} fehlt. Tipp: Auf der Seite den Lesezeichen-Button „➕ Urlaubsplanung“ klicken, dann wird alles übernommen.`;
  }
  return result;
}

function sourceName(s: string) {
  return s === "booking" ? "Booking.com" : s === "airbnb" ? "Airbnb" : "Die Seite";
}
