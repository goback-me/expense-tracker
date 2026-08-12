import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { CATEGORY_ICONS } from "@/lib/categories";

export type Receipt = {
  id: string;
  store_name: string;
  amount: number;
  category: string;
  purchased_at: string;
  thumbnail_url?: string | null;
  receipt_type?: "purchase" | "transfer" | "income" | null;
  direction?: "expense" | "income" | null;
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ReceiptCard({
  receipt,
  currency,
}: {
  receipt: Receipt;
  currency?: string | null;
}) {
  const isIncome = receipt.direction === "income";
  const icon = CATEGORY_ICONS[receipt.category] || "receipt";

  return (
    <Link
      href={`/receipts/${receipt.id}`}
      className="flex items-center justify-between rounded-card border border-outline-variant bg-surface p-md shadow-sm transition-all active:scale-[0.98] active:bg-surface-low"
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${
            isIncome ? "bg-secondary/10" : "bg-surface-high"
          }`}
        >
          <span
            className={`material-symbols-outlined ${
              isIncome ? "text-secondary" : "text-secondary"
            }`}
          >
            {isIncome ? "arrow_downward" : icon}
          </span>
        </div>
        <div>
          <p className="font-semibold text-on-surface">
            {receipt.store_name}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-on-surface-variant">
            <span>{formatTime(receipt.purchased_at)}</span>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <span className="rounded-lg bg-sage/10 px-2 py-0.5 text-xs font-semibold">
              {receipt.category}
            </span>
          </div>
        </div>
      </div>
      <span
        className={`font-semibold ${isIncome ? "text-secondary" : "text-on-surface"}`}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(receipt.amount, currency)}
      </span>
    </Link>
  );
}