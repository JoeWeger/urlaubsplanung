export function SetupNotice({ error }: { error?: string }) {
  return (
    <div className="card mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Datenbank einrichten</h1>
      <p className="mt-2 text-sm text-slate-600">
        Die App braucht eine Postgres-Datenbank. Auf Vercel geht das in zwei Minuten:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Vercel-Projekt öffnen → <b>Storage</b> → <b>Create Database</b> → <b>Neon (Postgres)</b>.</li>
        <li>Datenbank mit dem Projekt verbinden (setzt <code>DATABASE_URL</code> automatisch).</li>
        <li>Unter <b>Deployments</b> einmal <b>Redeploy</b> klicken.</li>
      </ol>
      <p className="mt-3 text-sm text-slate-600">Die Tabellen werden beim ersten Aufruf automatisch angelegt.</p>
      {error && <pre className="mt-4 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-500">{error}</pre>}
    </div>
  );
}
