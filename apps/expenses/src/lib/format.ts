// Shared display formatters. Previously copy-pasted across timeline, inbox,
// review, expense detail, and the swipe card.

export function formatMoney(amount: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

// Full date with year, e.g. "Apr 23, 2025". Falsy input renders an em dash.
export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

// Short date without year, e.g. "Apr 23".
export function formatDateShort(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}
