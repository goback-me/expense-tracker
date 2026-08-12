import Link from "next/link";

const CATEGORY_ICONS: Record<string, string> = {
  Groceries: "shopping_cart",
  Dining: "restaurant",
  Transport: "directions_car",
  Tech: "devices",
  Shopping: "shopping_bag",
  Other: "receipt",
};

export type Receipt = {
  id: string;
  store_name: string;
  amount: number;
  category: string;
  purchased_at: string;
  thumbnail_url?: string | null;
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const icon = CATEGORY_ICONS[receipt.category] || "receipt";

  return (
    <Link
      href={`/receipts/${receipt.id}`}
      className="flex items-center justify-between rounded-card border border-outline-variant bg-surface p-md shadow-sm transition-all active:scale-[0.98] active:bg-surface-low"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-high text-xl">
          <span className="material-symbols-outlined text-secondary">
            {icon}
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
      <span className="font-semibold text-on-surface">
        -${receipt.amount.toFixed(2)}
      </span>
    </Link>
  );
}