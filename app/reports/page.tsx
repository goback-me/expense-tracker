import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "#7FA88A",
  Dining: "#FFDAB9",
  Transport: "#000000",
  Tech: "#c4c7c7",
  Shopping: "#40674d",
  Other: "#747878",
};

export default async function ReportsPage() {
  const supabase = createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const { data: receipts } = await supabase
    .from("receipts")
    .select("amount, category, purchased_at")
    .gte("purchased_at", sevenDaysAgo.toISOString());

  const total = receipts?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;

  // Build day-of-week totals (Mon-Sun) for the last 7 days
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayTotals = new Array(7).fill(0);

  receipts?.forEach((r) => {
    const jsDay = new Date(r.purchased_at).getDay(); // 0=Sun..6=Sat
    const idx = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0..Sun=6
    dayTotals[idx] += Number(r.amount);
  });

  const maxDay = Math.max(...dayTotals, 1);
  const peakIdx = dayTotals.indexOf(Math.max(...dayTotals));

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  receipts?.forEach((r) => {
    categoryTotals[r.category] = (categoryTotals[r.category] || 0) + Number(r.amount);
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <>
      <header className="safe-top sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-background px-container-margin">
        <h1 className="text-lg font-bold tracking-tight text-primary">
          Reports
        </h1>
        <span className="material-symbols-outlined text-primary">
          date_range
        </span>
      </header>

      <main className="flex-1 overflow-y-auto px-container-margin py-lg pb-24 no-scrollbar">
        <div className="mb-lg flex w-full rounded-input bg-surface-low p-1">
          <button className="flex-1 rounded bg-white py-2 text-sm font-semibold text-primary shadow-sm">
            Spending
          </button>
          <button className="flex-1 py-2 text-sm font-semibold text-on-surface-variant">
            Categories
          </button>
        </div>

        <section className="mb-xl">
          <p className="text-sm text-on-surface-variant">Total Spent (7 days)</p>
          <p className="text-3xl font-bold text-primary">${total.toFixed(2)}</p>

          <div className="relative mt-md flex h-48 items-end justify-between rounded-input border border-outline-variant p-md">
            {dayTotals.map((amt, i) => (
              <div
                key={i}
                className={`w-[12%] rounded-t-sm transition-all ${
                  i === peakIdx ? "bg-primary" : "bg-sage/20"
                }`}
                style={{ height: `${Math.max((amt / maxDay) * 100, 4)}%` }}
                title={`$${amt.toFixed(2)}`}
              />
            ))}
          </div>
          <div className="mt-sm flex justify-between text-xs text-on-surface-variant">
            {dayLabels.map((d, i) => (
              <span
                key={d}
                className={i === peakIdx ? "font-bold text-primary" : ""}
              >
                {d}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-md text-lg font-bold text-primary">
            Top Categories
          </h2>
          {topCategories.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No spending data yet this week.
            </p>
          ) : (
            <div className="space-y-4">
              {topCategories.map(([cat, amt]) => {
                const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-primary">{cat}</span>
                      <span className="text-primary">
                        ${amt.toFixed(2)}{" "}
                        <span className="ml-1 text-sm text-on-surface-variant">
                          {pct}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-high">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CATEGORY_COLORS[cat] || "#747878",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
}
