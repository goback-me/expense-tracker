import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/get-user";
import BottomNav from "@/components/BottomNav";
import ReportsView from "@/components/ReportsView";

export default async function ReportsPage() {
  const supabase = createClient();

  const user = await getCachedUser();
  const currency = user?.user_metadata?.currency;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const { data: receipts } = await supabase
    .from("receipts")
    .select("amount, category, purchased_at, direction")
    .gte("purchased_at", sevenDaysAgo.toISOString());

  const expenseRows = receipts?.filter((r) => r.direction !== "income") ?? [];
  const incomeRows = receipts?.filter((r) => r.direction === "income") ?? [];

  const totalExpense = expenseRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalIncome = incomeRows.reduce((sum, r) => sum + Number(r.amount), 0);

  // Build day-of-week totals (Mon-Sun) for the last 7 days — expenses only,
  // since the bar chart is specifically about spending.
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const expenseDayTotals = new Array(7).fill(0);

  expenseRows.forEach((r) => {
    const jsDay = new Date(r.purchased_at).getDay(); // 0=Sun..6=Sat
    const idx = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0..Sun=6
    expenseDayTotals[idx] += Number(r.amount);
  });

  function topCategoriesFor(rows: typeof expenseRows) {
    const totals: Record<string, number> = {};
    rows.forEach((r) => {
      totals[r.category] = (totals[r.category] || 0) + Number(r.amount);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }

  const expenseCategories = topCategoriesFor(expenseRows);
  const incomeCategories = topCategoriesFor(incomeRows);

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
        <ReportsView
          currency={currency}
          dayLabels={dayLabels}
          expenseDayTotals={expenseDayTotals}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      </main>
      <BottomNav />
    </>
  );
}