import type { Trip } from "@/lib/data";

const COLORS = ["#0ea5e9", "#f97316", "#10b981", "#8b5cf6", "#ef4444", "#eab308", "#ec4899", "#14b8a6"];

export function TripFields({ trip }: { trip?: Trip }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Name</label>
        <input name="name" required defaultValue={trip?.name} placeholder="z. B. Kanada 2027" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Ziel / Land</label>
        <input name="destination" defaultValue={trip?.destination ?? ""} placeholder="Kanada" className="input" />
      </div>
      <div>
        <label className="label">Start</label>
        <input type="date" name="start_date" defaultValue={trip?.start_date ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Ende</label>
        <input type="date" name="end_date" defaultValue={trip?.end_date ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Farbe</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={trip ? trip.color === c : i === 0}
                className="peer sr-only"
              />
              <span
                className="block h-7 w-7 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900"
                style={{ background: c }}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notizen</label>
        <textarea name="notes" rows={2} defaultValue={trip?.notes ?? ""} className="input" />
      </div>
    </div>
  );
}
