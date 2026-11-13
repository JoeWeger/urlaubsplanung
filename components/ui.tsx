"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingText ?? "…" : children}
    </button>
  );
}

export function ConfirmButton({
  children,
  message = "Wirklich löschen?",
  className = "btn-danger",
}: {
  children: React.ReactNode;
  message?: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function AutoUpload({ action, id }: { action: (f: FormData) => Promise<void>; id: number }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:border-sky-400 hover:text-sky-700">
        <UploadLabel />
        <input
          type="file"
          name="files"
          accept="application/pdf,image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            const big = files.find((x) => x.size > 4 * 1024 * 1024);
            if (big) {
              alert(`${big.name} ist größer als 4 MB.`);
              e.currentTarget.value = "";
              return;
            }
            if (files.length) e.currentTarget.form?.requestSubmit();
          }}
        />
      </label>
    </form>
  );
}

function UploadLabel() {
  const { pending } = useFormStatus();
  return <span>{pending ? "Lade hoch …" : "📎 PDF / Ticket hochladen"}</span>;
}
