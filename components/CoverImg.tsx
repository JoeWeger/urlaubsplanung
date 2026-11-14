"use client";

import { useEffect, useRef, useState } from "react";

/** Bild, das sich bei Ladefehler ausblendet (dann bleibt der Farbverlauf sichtbar) */
export function CoverImg({ src, className = "" }: { src: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  useEffect(() => {
    // Fehler kann schon vor der Hydration passiert sein
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "ok" : "failed");
  }, []);
  if (state === "failed") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onLoad={() => setState("ok")}
      onError={() => setState("failed")}
      className={`${className} transition-opacity duration-500 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
    />
  );
}
