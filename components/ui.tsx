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
