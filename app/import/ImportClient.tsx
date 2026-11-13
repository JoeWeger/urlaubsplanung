"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { previewImport, saveImport, type ImportPreview } from "@/app/actions";
import { fmtMoney, fmtRange, sourceLabel } from "@/lib/format";
import { SubmitButton } from "@/components/ui";

export function ImportClient() {
  const [data, setData] = useState<{ url: string; html: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const url = params.get("u");
    const html = params.get("h") ?? "";
    if (!url) {
      setError("Keine Daten gefunden. Öffne eine Booking- oder Airbnb-Seite und klicke dort auf das Lesezeichen „➕ Urlaubsplanung“.");
      return;
    }
    setData({ url, html });
    // Hash aus der Adresszeile entfernen (kann sehr lang sein)
    history.replaceState(null, "", "/import");
    previewImport(url, html)
      .then(setPreview)
      .catch((e) => setError(`Konnte nicht ausgelesen werden: ${e.message}`));
  }, []);

  if (error)
    return (
      <div className="card mx-auto max-w-xl p-6">
        <p className="text-sm text-slate-600">{error}</p>
        <Link href="/lesezeichen" className="btn-primary mt-4">Lesezeichen einrichten</Link>
      </div>
    );
  if (!preview || !data) return <div className="card mx-auto max-w-xl p-6 text-sm text-slate-500">Lese Unterkunft aus …</div>;

  const l = preview.listing;
  const trips = Array.from(new Set(preview.stops.map((s) => s.trip)));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Unterkunft übernehmen</h1>
      <div className="card flex flex-col overflow-hidden sm:flex-row">
        <div className="aspect-video bg-slate-100 sm:aspect-auto sm:w-56 sm:shrink-0">
          {l.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-full min-h-32 place-items-center text-4xl text-slate-300">🏨</div>
          )}
        </div>
        <div className="flex-1 p-4">
          <span className="chip bg-slate-100 text-slate-600">{sourceLabel(l.source)}</span>
          <h2 className="mt-1 text-lg font-semibold">{l.name ?? "Unbekannte Unterkunft"}</h2>
          {l.address && <p className="text-xs text-slate-500">{l.address}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400">Preis</div>
              <div className="font-semibold">{fmtMoney(l.price_total ?? l.price_per_night, l.currency)}{l.price_total == null && l.price_per_night != null ? " / Nacht" : ""}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Bewertung</div>
              <div className="font-semibold">
                {l.rating != null ? `${l.rating_scale === 5 ? "★ " : ""}${l.rating}${l.rating_scale ? ` / ${l.rating_scale}` : ""}` : "–"}
                {l.review_count != null && <span className="font-normal text-slate-500"> ({l.review_count})</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Reisedaten</div>
              <div className="font-semibold">{l.checkin ? fmtRange(l.checkin, l.checkout) : "–"}</div>
            </div>
          </div>
          {l.warning && <p className="mt-2 text-xs text-amber-600">{l.warning}</p>}
        </div>
      </div>

      {preview.existing.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold">Schon in deiner Liste – aktualisieren?</h3>
          <div className="mt-2 space-y-2">
            {preview.existing.map((h) => (
              <form key={h.id} action={saveImport} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm">
                <input type="hidden" name="url" value={data.url} />
                <input type="hidden" name="html" value={data.html} />
                <input type="hidden" name="existing_id" value={h.id} />
                <input type="hidden" name="stop_id" value={h.stop_id} />
                <span className="min-w-0 truncate">{h.name} <span className="text-slate-400">· {h.stop}</span></span>
                <SubmitButton className="btn-primary shrink-0 px-3 py-1.5 text-xs" pendingText="Speichere …">Aktualisieren</SubmitButton>
              </form>
            ))}
          </div>
        </div>
      )}

      <form action={saveImport} className="card space-y-3 p-4">
        <input type="hidden" name="url" value={data.url} />
        <input type="hidden" name="html" value={data.html} />
        <h3 className="font-semibold">{preview.existing.length ? "…oder neu hinzufügen zu" : "Zu welchem Stopp hinzufügen?"}</h3>
        {preview.stops.length === 0 ? (
          <p className="text-sm text-slate-500">Lege zuerst einen Urlaub mit Stopps an.</p>
        ) : (
          <>
            <select name="stop_id" defaultValue={preview.suggestedStop ?? preview.stops[0].id} className="input">
              {trips.map((t) => (
                <optgroup key={t} label={t}>
                  {preview.stops
                    .filter((s) => s.trip === t)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({fmtRange(s.start_date, s.end_date)})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <SubmitButton className="btn-primary w-full" pendingText="Speichere …">Hinzufügen</SubmitButton>
          </>
        )}
      </form>
    </div>
  );
}
