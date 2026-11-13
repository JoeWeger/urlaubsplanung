/** Landeswährung je Länderkürzel aus Booking-Links (/hotel/<land>/…) */
const EURO = "at be cy de ee es fi fr gr hr ie it lt lu lv mt nl pt si sk me xk ad mc sm va".split(" ");
const COUNTRY_CURRENCY: Record<string, string> = {
  ca: "CAD", us: "USD", gb: "GBP", ch: "CHF", li: "CHF", jp: "JPY", au: "AUD", nz: "NZD", mx: "MXN",
  th: "THB", id: "IDR", vn: "VND", my: "MYR", sg: "SGD", ph: "PHP", in: "INR", lk: "LKR", ae: "AED",
  tr: "TRY", eg: "EGP", ma: "MAD", za: "ZAR", br: "BRL", ar: "ARS", cl: "CLP", pe: "PEN", co: "COP",
  cr: "CRC", is: "ISK", no: "NOK", se: "SEK", dk: "DKK", pl: "PLN", cz: "CZK", hu: "HUF", ro: "RON",
  bg: "BGN", rs: "RSD", al: "ALL", ba: "BAM", mk: "MKD", cn: "CNY", hk: "HKD", tw: "TWD", kr: "KRW",
  il: "ILS", jo: "JOD", qa: "QAR", om: "OMR", mv: "USD", cu: "CUP", do: "DOP", ke: "KES", tz: "TZS",
};

export function currencyForCountry(cc?: string | null): string | null {
  if (!cc) return null;
  const c = cc.toLowerCase();
  if (EURO.includes(c)) return "EUR";
  return COUNTRY_CURRENCY[c] ?? null;
}

declare global {
  // eslint-disable-next-line no-var
  var __fxCache: Map<string, { rate: number; at: number }> | undefined;
}

/** Wechselkurs from → to (ECB-Kurse über frankfurter, Fallback open.er-api.com), 12 h gecacht */
export async function getRate(from: string, to = "EUR"): Promise<number | null> {
  if (from === to) return 1;
  const cache = (global.__fxCache ??= new Map());
  const key = `${from}-${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.rate;

  const sources: [string, (j: Record<string, unknown>) => unknown][] = [
    [`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, (j) => (j.rates as Record<string, number>)?.[to]],
    [`https://open.er-api.com/v6/latest/${from}`, (j) => (j.rates as Record<string, number>)?.[to]],
  ];
  for (const [url, pick] of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const rate = Number(pick(await res.json()));
      if (Number.isFinite(rate) && rate > 0) {
        cache.set(key, { rate, at: Date.now() });
        return rate;
      }
    } catch {
      /* nächste Quelle */
    }
  }
  return null;
}
