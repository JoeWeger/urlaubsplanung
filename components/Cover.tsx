import { CoverImg } from "./CoverImg";

/**
 * Titelbild für Urlaube und Stopps: echtes Foto (z. B. vom gebuchten Hotel)
 * oder ein Farbverlauf in der Reisefarbe mit stilisierter Landschaft.
 */
export function Cover({
  color = "#2e6553",
  image,
  className = "",
  children,
  rounded = "rounded-3xl",
  shade = true,
}: {
  color?: string | null;
  image?: string | null;
  className?: string;
  children?: React.ReactNode;
  rounded?: string;
  shade?: boolean;
}) {
  const c = color || "#2e6553";
  return (
    <div
      className={`grain relative overflow-hidden ${rounded} ${className}`}
      style={{
        background: `linear-gradient(140deg, color-mix(in oklab, ${c} 82%, white) 0%, ${c} 45%, color-mix(in oklab, ${c} 55%, #1d1a16) 100%)`,
      }}
    >
      <svg
          className="absolute inset-x-0 bottom-0 h-3/4 w-full"
          viewBox="0 0 400 200"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden
        >
          <circle cx="300" cy="70" r="26" fill="white" fillOpacity="0.22" />
          <path d="M0 150 L70 90 L120 125 L190 55 L260 120 L320 85 L400 140 V200 H0Z" fill="white" fillOpacity="0.10" />
          <path d="M0 175 L60 140 L130 165 L210 115 L290 160 L350 135 L400 160 V200 H0Z" fill="black" fillOpacity="0.12" />
        </svg>
      {image && <CoverImg src={image} className="absolute inset-0 h-full w-full object-cover" />}
      {shade && <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />}
      <div className="relative h-full">{children}</div>
    </div>
  );
}
