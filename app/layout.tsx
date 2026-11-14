import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urlaubsplanung",
  description: "Reisen, Stopps, Hotels und Aktivitäten planen",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4efe6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-sand/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-paper transition group-hover:rotate-12">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" />
                </svg>
              </span>
              <span className="font-display text-lg leading-none sm:text-xl">
                Urlaubsplanung<span className="text-sky-600">.</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 rounded-full border border-line bg-paper/70 p-1 text-sm shadow-[var(--shadow-soft)]">
              <Link href="/" className="rounded-full px-3 py-1.5 text-slate-600 sm:px-3.5 transition hover:bg-sand hover:text-ink">Reisen</Link>
              <Link href="/kalender" className="rounded-full px-3 py-1.5 text-slate-600 sm:px-3.5 transition hover:bg-sand hover:text-ink">Kalender</Link>
              <Link href="/lesezeichen" className="hidden rounded-full px-3 py-1.5 text-slate-600 sm:px-3.5 transition hover:bg-sand hover:text-ink sm:block">Lesezeichen</Link>
            </nav>
          </div>
        </header>
        <main className="rise mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-slate-400">
          Gute Reise ✦
        </footer>
      </body>
    </html>
  );
}
