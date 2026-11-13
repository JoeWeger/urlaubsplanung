# Urlaubsplanung

Reisen planen: Urlaube mit Start/Ende, Flügen, Stopps (z. B. Montreal → Québec → Toronto),
Hotel-Vergleich per Booking-/Airbnb-Link und Aktivitäten pro Tag – alles mit Links und Kalender.

## Funktionen

- **Mehrere Urlaube** mit Farbe, Zeitraum, Notizen
- **Flüge** (Airline, Flugnummer, Zeiten, Buchungscode, Preis, Link)
- **Stopps** pro Urlaub → Klick öffnet Hotels + geplante Aktivitäten
- **Hotel-Import**: Booking.com-/Airbnb-Link einfügen → Name, Bild, Bewertung, Anzahl Bewertungen,
  Preis (wenn verfügbar) werden ausgelesen. Gesamtpreis wird aus Check-in/Check-out der URL berechnet.
  Alles nachträglich editierbar.
- **Vergleich**: Tabelle + Karten, sortierbar nach Preis/Bewertung, günstigste & beste Bewertung markiert,
  Status Favorit / Gebucht / Verworfen, Button direkt zum Angebot
- **Kalender**: Gesamtübersicht aller Urlaube + Reisekalender je Urlaub (Stopps, Flüge, Aktivitäten)
- **Budget**: Flüge + gebuchte Hotels + Aktivitäten
- Optionaler **Passwortschutz** über `APP_PASSWORD`

## Deployment auf Vercel

1. vercel.com → **Add New → Project** → dieses GitHub-Repo importieren → Deploy.
2. Im Projekt: **Storage → Create Database → Neon (Postgres)** → mit dem Projekt verbinden
   (setzt `DATABASE_URL` automatisch).
3. Optional: **Settings → Environment Variables** → `APP_PASSWORD` setzen.
4. **Redeploy**. Die Tabellen werden beim ersten Aufruf automatisch angelegt.

## Lokal

```bash
cp .env.example .env.local   # DATABASE_URL auf eine Postgres-DB zeigen lassen
npm install
npm run dev
```

## Hinweis zum Auslesen der Links

Booking.com und Airbnb ändern ihr HTML häufig und blockieren teils Anfragen von Servern.
Das Auslesen ist daher „best effort“: Fehlt etwas (meist der Preis, der von den Reisedaten abhängt),
kann es in der Karte unter „Details bearbeiten“ ergänzt werden. „↻ Neu auslesen“ versucht es erneut.

### Preis bei Booking.com

Kopierst du den Link aus der Suchergebnisliste bzw. nach Auswahl der Daten, steht der Preis des Zimmers
im Link (`sr_pri_blocks=…__57549` = 575,49). Der wird immer übernommen – auch wenn Booking die Seite blockiert.

### Optional: Scraping-Dienst für Bewertungen/Bilder

Booking.com blockiert Anfragen von Rechenzentren (auch Vercel) häufig. Dann fehlen Bewertung und Bild.
Abhilfe: einen Scraping-Dienst (z. B. ScraperAPI, ScrapingBee) als Umgebungsvariable eintragen:

```
SCRAPE_PROXY_URL=https://api.scraperapi.com/?api_key=DEIN_KEY&country_code=de&url={url}
```
