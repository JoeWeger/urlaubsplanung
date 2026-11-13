"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card space-y-3 p-6">
      <h1 className="text-xl font-semibold">🔒 Anmelden</h1>
      <input type="hidden" name="next" value={next} />
      <input type="password" name="password" autoFocus required placeholder="Passwort" className="input" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>Weiter</button>
    </form>
  );
}
