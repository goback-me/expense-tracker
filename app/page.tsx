import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/get-user";
import BottomNav from "@/components/BottomNav";
import ReceiptCard, { Receipt } from "@/components/ReceiptCard";
import { formatCurrency } from "@/lib/currency";

export default async function HomePage() {
  const supabase = createClient();

  const user = await getCachedUser();
  const currency = user?.user_metadata?.currency;

  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const { data: monthReceipts } = await supabase
    .from("receipts")
    .select("amount, direction")
    .gte("purchased_at", firstDayOfMonth.toISOString());

  const { data: recentReceipts } = await supabase
    .from("receipts")
    .select("id, store_name, amount, category, purchased_at, thumbnail_url, receipt_type, direction")
    .order("purchased_at", { ascending: false })
    .limit(3);

  const monthExpense =
    monthReceipts?.filter((r) => r.direction !== "income")
      .reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;
  const monthIncome =
    monthReceipts?.filter((r) => r.direction === "income")
      .reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;
  const netTotal = monthIncome - monthExpense;
  const receiptCount = monthReceipts?.length ?? 0;

  const displayName =
    user?.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <>
      <main className="flex-1 overflow-y-auto px-container-margin pb-24 pt-6 no-scrollbar animate-fade-in">
        <div className="mb-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface-low text-sm font-semibold text-primary">
              {displayName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-on-surface-variant">Welcome back,</p>
              <h2 className="text-lg font-bold text-primary">{displayName}</h2>
            </div>
          </div>
          <Link
            href="/settings"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface"
          >
            <span className="material-symbols-outlined text-primary">
              notifications
            </span>
          </Link>
        </div>

        <section
          className="relative mb-md overflow-hidden rounded-card p-6 text-white shadow-sm animate-pop-in"
          style={{
            background: "linear-gradient(135deg, #A8D5BA 0%, #7FA88A 100%)",
          }}
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white opacity-10" />
          <p className="mb-1 text-sm font-medium text-white/80">
            This Month&apos;s Net
          </p>
          <h3 className="mb-md text-4xl font-bold">
            {netTotal >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(netTotal), currency)}
          </h3>
          <div className="flex w-max items-center gap-2 rounded-full border border-white/20 bg-black/10 px-3 py-1.5 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[16px] leading-none">
              receipt
            </span>
            <span className="text-xs font-semibold tracking-wide">
              {receiptCount} entr{receiptCount === 1 ? "y" : "ies"} this month
            </span>
          </div>
        </section>

        {/* Income vs Expense breakdown — this is what "nets" against the
            headline figure above, so it's always visible right below it. */}
        <section className="mb-lg grid grid-cols-2 gap-3">
          <div className="rounded-card border border-outline-variant bg-surface p-md">
            <div className="mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-secondary">
                arrow_downward
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Income
              </span>
            </div>
            <p className="text-lg font-bold text-secondary">
              {formatCurrency(monthIncome, currency)}
            </p>
          </div>
          <div className="rounded-card border border-outline-variant bg-surface p-md">
            <div className="mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">
                arrow_upward
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Expenses
              </span>
            </div>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(monthExpense, currency)}
            </p>
          </div>
        </section>

        <section className="mb-lg grid grid-cols-4 gap-3">
          <Link href="/scan" className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-outline-variant bg-surface shadow-sm transition-colors group-active:bg-sage/10 group-active:border-sage">
              <span className="material-symbols-outlined transition-colors group-active:text-secondary">photo_camera</span>
            </div>
            <span className="text-center text-xs font-semibold text-on-surface-variant">
              Scan
            </span>
          </Link>
          <Link href="/receipts/new" className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-outline-variant bg-surface shadow-sm transition-colors group-active:bg-sage/10 group-active:border-sage">
              <span className="material-symbols-outlined transition-colors group-active:text-secondary">add</span>
            </div>
            <span className="text-center text-xs font-semibold text-on-surface-variant">
              Add
              <br />
              Expense
            </span>
          </Link>
          <Link href="/receipts/new?type=income" className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-outline-variant bg-surface shadow-sm transition-colors group-active:bg-sage/10 group-active:border-sage">
              <span className="material-symbols-outlined transition-colors group-active:text-secondary">savings</span>
            </div>
            <span className="text-center text-xs font-semibold text-on-surface-variant">
              Add
              <br />
              Income
            </span>
          </Link>
          <Link href="/reports" className="group flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-outline-variant bg-surface shadow-sm transition-colors group-active:bg-sage/10 group-active:border-sage">
              <span className="material-symbols-outlined transition-colors group-active:text-secondary">bar_chart</span>
            </div>
            <span className="text-center text-xs font-semibold text-on-surface-variant">
              Reports
            </span>
          </Link>
        </section>

        <section>
          <div className="mb-md flex items-end justify-between">
            <h4 className="text-lg font-bold text-primary">Recent Activity</h4>
            <Link href="/receipts" className="text-sm font-semibold text-on-surface-variant">
              See All
            </Link>
          </div>

          {recentReceipts && recentReceipts.length > 0 ? (
            <div className="space-y-3">
              {recentReceipts.map((r, i) => (
                <div
                  key={r.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <ReceiptCard receipt={r as Receipt} currency={currency} />
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-fade-in rounded-card border border-dashed border-outline-variant p-lg text-center">
              <span className="material-symbols-outlined mb-sm text-3xl text-outline">
                receipt_long
              </span>
              <p className="text-sm text-on-surface-variant">
                No entries yet. Tap Scan to add your first one.
              </p>
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
}