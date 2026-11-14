"use client";

import { useEffect, useRef, useState } from "react";

export function BookmarkletLink({ code }: { code: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  // React blockiert javascript:-Links im JSX, daher direkt am DOM setzen
  useEffect(() => {
    ref.current?.setAttribute("href", code);
  }, [code]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        ref={ref}
        onClick={(e) => {
          e.preventDefault();
          alert("Nicht klicken – in die Lesezeichenleiste ziehen 🙂");
        }}
        className="inline-flex cursor-grab items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 font-medium text-paper shadow-[var(--shadow-lift)] transition hover:-translate-y-0.5"
      >
        ➕ Urlaubsplanung
      </a>
      <button
        className="btn-ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "✓ Kopiert" : "Code kopieren (für Handy)"}
      </button>
    </div>
  );
}
