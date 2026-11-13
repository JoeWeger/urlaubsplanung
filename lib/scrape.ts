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
  return h.replace(/^www\./, "");
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
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${k}["']`,
    "i",
  );
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() || null : null;
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
  const parts = [a.streetAddress, a.postalCode, a.addressLocality, a.addressRegion, a.addressCountry]
    .map((p) => (typeof p === "object" && p ? str((p as Record<string, unknown>).name) : str(p)))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
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
  r.image = str(ld?.image) || str(ld?.photo) || meta(html, "og:image") || meta(html, "twitter:image");
  r.address = addressStr(ld?.address);
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
    // Airbnb-Titel enthalten oft nur die Kategorie; besseren Namen aus JSON suchen
    const listingName = html.match(/"listingTitle"\s*:\s*"([^"]{4,120})"/);
    if ((!r.name || /^(Wohnung|Unterkunft|Rental unit|Home|Condo|Loft|Haus)\b/i.test(r.name)) && listingName) {
      r.description = r.description || r.name || null;
      r.name = decodeEntities(listingName[1]);
    }
  }

  if (source === "booking") {
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

  if (price != null) {
    // priceRange bei Booking ist in der Regel "ab X pro Nacht"
    r.price_per_night = price;
    r.currency = currency || null;
  }
  return r;
}

export async function scrapeListing(rawUrl: string): Promise<ScrapedListing> {
  const url = new URL(rawUrl.trim());
  const source = detectSource(url);
  const { checkin, checkout } = datesFromUrl(url);

  const base: ScrapedListing = {
    url: url.toString(),
    source,
    name: nameFromUrl(url, source),
    image: null,
    address: null,
    description: null,
    price_total: null,
    price_per_night: null,
    currency: null,
    rating: null,
    rating_scale: source === "airbnb" ? 5 : source === "booking" ? 10 : null,
    review_count: null,
    checkin,
    checkout,
    fetched: false,
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(t);
    if (!res.ok) {
      return { ...base, warning: `Seite antwortete mit Status ${res.status} – bitte Daten ergänzen.` };
    }
    const html = await res.text();
    const parsed = parseListingHtml(html, new URL(res.url || url.toString()));
    const merged: ScrapedListing = { ...base, fetched: true };
    for (const [k, v] of Object.entries(parsed)) {
      if (v != null && v !== "") (merged as Record<string, unknown>)[k] = v;
    }
    const n = nights(checkin, checkout);
    if (merged.price_per_night != null && n) merged.price_total = Math.round(merged.price_per_night * n);
    if (!merged.name && !merged.rating) {
      merged.warning = "Seite konnte kaum ausgelesen werden (evtl. Bot-Schutz) – bitte Daten ergänzen.";
    } else if (merged.price_per_night == null) {
      merged.warning = "Preis nicht gefunden (hängt oft von Reisedaten ab) – bitte manuell eintragen.";
    }
    return merged;
  } catch (e) {
    return {
      ...base,
      warning: `Seite konnte nicht geladen werden (${(e as Error).name === "AbortError" ? "Zeitüberschreitung" : "blockiert"}) – bitte Preis & Bewertung ergänzen.`,
    };
  }
}
