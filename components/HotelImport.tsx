"use client";

import { useActionState } from "react";
import { importHotel, type ImportState } from "@/app/actions";

export function HotelImport({ stopId }: { stopId: number }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importHotel, null);

  return (
    <form action={action} data-import className="card p-4">
      <input type="hidden" name="stop_id" value={stopId} />
      <label className="label">Booking.com-, Airbnb- oder anderen Unterkunfts-Link einfügen</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="url"
          required
          placeholder="https://www.booking.com/hotel/ca/… oder https://www.airbnb.de/rooms/…"
          className="input flex-1"
          onPaste={(e) => {
            const form = e.currentTarget.form;
            setTimeout(() => form?.requestSubmit(), 50);
          }}
        />
        <button className="btn-primary whitespace-nowrap" disabled={pending}>
          {pending ? "Lese aus …" : "Hinzufügen"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        Tipp: Link mit Reisedaten kopieren (Check-in/Check-out in der URL), dann wird der Gesamtpreis berechnet.
      </p>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <p className={`mt-2 text-sm ${state.warning ? "text-amber-600" : "text-emerald-600"}`}>
          {state.warning ? `Hinzugefügt. ${state.warning}` : "Hinzugefügt ✓"}
        </p>
      )}
    </form>
  );
}
