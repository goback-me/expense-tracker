export const CURRENCY_OPTIONS = [
  { code: "PKR", label: "Pakistani Rupee", symbol: "Rs" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "AED", label: "UAE Dirham", symbol: "AED" },
  { code: "SAR", label: "Saudi Riyal", symbol: "SAR" },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "PKR";

export function getCurrencySymbol(code?: string | null): string {
  const match = CURRENCY_OPTIONS.find((c) => c.code === code);
  return match?.symbol ?? "Rs";
}

/**
 * Formats a number with the user's chosen currency symbol.
 * Deliberately avoids Intl's currency style — ICU currency data support is
 * inconsistent across server runtimes, so we format manually for a
 * consistent "Rs 1,234.00" style everywhere in the app.
 */
export function formatCurrency(amount: number, code?: string | null): string {
  const symbol = getCurrencySymbol(code);
  const formattedNumber = (amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formattedNumber}`;
}