"use client";

import { useActionState } from "react";
import { importActivity, type ImportState } from "@/app/actions";

export function ActivityImport({ stopId, days }: { stopId: number; days: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importActivity, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="stop_id" value={stopId} />
      <label className="label">Per Link – GetYourGuide, Viator, Tripadvisor …</label>
      <input name="url" required placeholder="https://www.getyourguide.de/…" className="input" />
      <div className="flex gap-2">
        {days.length > 0 && (
          <select name="date" defaultValue="" className="input flex-1">
            <option value="">Ohne Datum</option>
            {days.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        )}
        <button className="btn-primary shrink-0" disabled={pending}>
          {pending ? "Lese aus …" : "Übernehmen"}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className={`text-xs ${state.warning ? "text-[#8a6620]" : "text-sky-700"}`}>{state.warning ? `Hinzugefügt. ${state.warning}` : "Hinzugefügt ✓"}</p>}
    </form>
  );
}
