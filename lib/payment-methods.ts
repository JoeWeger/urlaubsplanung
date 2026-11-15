/** Zahlungsarten – "paid" = zählt als bezahlt */
export const PAYMENT_METHODS = [
  { value: "open", label: "Muss noch bezahlt werden", short: "Noch zu zahlen", icon: "🔴", paid: false },
  { value: "onsite", label: "Vor Ort bezahlen", short: "Vor Ort", icon: "📍", paid: false },
  { value: "amex", label: "Amex", short: "Amex", icon: "💳", paid: true },
  { value: "revolut", label: "Revolut", short: "Revolut", icon: "💳", paid: true },
  { value: "other", label: "Anders bezahlt", short: "Bezahlt", icon: "✓", paid: true },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const methodInfo = (v?: string | null) => PAYMENT_METHODS.find((m) => m.value === v);

/** Zahlungsart aus gespeicherten Daten ableiten (alte Einträge hatten nur "bezahlt ja/nein") */
export function effectiveMethod(method: string | null | undefined, paid: boolean | null | undefined): PaymentMethod {
  if (method && methodInfo(method)) return method as PaymentMethod;
  return paid ? "other" : "open";
}

/** Spalten der Finanztabelle: Posten | Betrag | Zahlung | Anteil | Storno bis | Teilen */
export const FIN_GRID = "lg:grid-cols-[minmax(0,1fr)_7.5rem_11rem_10.5rem_11.5rem_5.5rem]";
