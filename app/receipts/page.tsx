import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/get-user";
import BottomNav from "@/components/BottomNav";
import ReceiptCard, { Receipt } from "@/components/ReceiptCard";

function groupByDate(receipts: Receipt[]) {
  const groups: Record<string, Receipt[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const r of receipts) {
    const d = new Date(r.purchased_at);
    let label: string;
    if (d.toDateString() === today) label = "Today";
    else if (d.toDateString() === yesterday) label = "Yesterday";
    else
      label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

    groups[label] = groups[label] || [];
    groups[label].push(r);
  }
  return groups;
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const supabase = createClient();

  const user = await getCachedUser();
  const currency = user?.user_metadata?.currency;

  let query = supabase
    .from("receipts")
    .select("id, store_name, amount, category, purchased_at, thumbnail_url, receipt_type, direction")
    .order("purchased_at", { ascending: false });

  if (searchParams.category === "Income") {
    query = query.eq("direction", "income");
  } else if (searchParams.category && searchParams.category !== "All") {
    query = query.eq("category", searchParams.category);
  }

  const { data: receipts } = await query;
  const groups = groupByDate((receipts as Receipt[]) || []);
  const categories = ["All", "Groceries", "Dining", "Transport", "Tech", "Shopping", "Transfer", "Income"];
  const activeCategory = searchParams.category || "All";

  return (
    <>
      <header className="safe-top sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-background px-container-margin">
        <h1 className="text-lg font-bold tracking-tight text-primary">
          Receipts
        </h1>
        <div className="flex items-center gap-3 text-on-surface-variant">
          <Link
            href="/receipts/import"
            aria-label="Import from SMS or statement"
            className="flex items-center gap-1 rounded-full border border-outline-variant bg-surface-low px-3 py-1.5 text-xs font-semibold text-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">sms</span>
            Import
          </Link>
          <span className="material-symbols-outlined">search</span>
          <span className="material-symbols-outlined">tune</span>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-outline-variant px-container-margin py-md no-scrollbar">
        {categories.map((c) => (
          <a
            key={c}
            href={c === "All" ? "/receipts" : `/receipts?category=${c}`}
            className={`whitespace-nowrap rounded-full px-md py-sm text-xs font-semibold transition-all active:scale-95 ${
              activeCategory === c
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-low text-on-surface"
            }`}
          >
            {c}
          </a>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-container-margin py-lg pb-24 no-scrollbar">
        {Object.keys(groups).length === 0 && (
          <div className="mt-xl rounded-card border border-dashed border-outline-variant p-lg text-center">
            <span className="material-symbols-outlined mb-sm text-3xl text-outline">
              receipt_long
            </span>
            <p className="text-sm text-on-surface-variant">
              No receipts in this category yet.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-xl animate-fade-in">
          {Object.entries(groups).map(([label, items]) => (
            <section key={label}>
              <h2 className="mb-md text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {label}
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((r) => (
                  <ReceiptCard key={r.id} receipt={r} currency={currency} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  );
} 