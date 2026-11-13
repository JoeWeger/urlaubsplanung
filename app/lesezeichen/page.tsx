import { headers } from "next/headers";
import { bookmarkletCode } from "@/lib/bookmarklet";
import { BookmarkletLink } from "./BookmarkletLink";

export const dynamic = "force-dynamic";

export default async function LesezeichenPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const code = bookmarkletCode(`${proto}://${host}`);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Hotels mit einem Klick übernehmen</h1>
      <div className="card space-y-3 p-5 text-sm text-slate-700">
        <p>
          Booking.com und Airbnb blockieren automatische Abfragen von Servern – darum fehlen beim Link-Einfügen
          manchmal Foto und Bewertung. Mit diesem Lesezeichen liest die App die Daten direkt aus der Seite,
          die du gerade in deinem Browser offen hast: <b>Foto, Bewertung, Anzahl Bewertungen, Adresse und Preis</b>.
        </p>
        <h2 className="pt-2 font-semibold">Am Computer einrichten (einmalig)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Lesezeichenleiste einblenden (Chrome/Edge: <kbd>Strg/⌘ + Umschalt + B</kbd>, Safari: Darstellung → Favoritenleiste).</li>
          <li>Den blauen Button unten mit der Maus in die Lesezeichenleiste <b>ziehen</b>.</li>
        </ol>
        <BookmarkletLink code={code} />
        <h2 className="pt-2 font-semibold">Benutzen</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Auf Booking.com bzw. Airbnb das Hotel mit deinen Reisedaten öffnen.</li>
          <li>In der Lesezeichenleiste auf <b>➕ Urlaubsplanung</b> klicken.</li>
          <li>Stopp auswählen → <b>Hinzufügen</b>. Ist das Hotel schon in der Liste, kannst du es stattdessen aktualisieren.</li>
        </ol>
        <h2 className="pt-2 font-semibold">Am iPhone / Android</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Oben „Code kopieren“ tippen.</li>
          <li>Irgendeine Seite als Lesezeichen speichern, Name „Urlaubsplanung“.</li>
          <li>Lesezeichen bearbeiten und die Adresse durch den kopierten Code ersetzen.</li>
          <li>Auf der Hotelseite die Adresszeile antippen, „Urlaubsplanung“ eintippen und das Lesezeichen auswählen.</li>
        </ol>
      </div>
    </div>
  );
}
