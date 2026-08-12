"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { CATEGORY_COLORS } from "@/lib/categories";

type CategoryTotal = [string, number];

export default function ReportsView({
  currency,
  dayLabels,
  expenseDayTotals,
  totalIncome,
  totalExpense,
  expenseCategories,
  incomeCategories,
}: {
  currency?: string | null;
  dayLabels: string[];
  expenseDayTotals: number[];
  totalIncome: number;
  totalExpense: number;
  expenseCategories: CategoryTotal[];
  incomeCategories: CategoryTotal[];
}) {
  const [tab, setTab] = useState<"spending" | "income">("spending");

  const netTotal = totalIncome - totalExpense;
  const maxDay = Math.max(...expenseDayTotals, 1);
  const peakIdx = expenseDayTotals.indexOf(Math.max(...expenseDayTotals));

  return (
    <>
      {/* Always-visible summary — this is the "full detailed summary" view */}
      <section className="mb-lg grid grid-cols-3 gap-2">
        <div className="rounded-card border border-outline-variant bg-surface p-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Income
          </p>
          <p className="mt-1 text-sm font-bold text-secondary">
            {formatCurrency(totalIncome, currency)}
          </p>
        </div>
        <div className="rounded-card border border-outline-variant bg-surface p-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Expenses
          </p>
          <p className="mt-1 text-sm font-bold text-primary">
            {formatCurrency(totalExpense, currency)}
          </p>
        </div>
        <div className="rounded-card border border-outline-variant bg-surface p-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Net
          </p>
          <p className={`mt-1 text-sm font-bold ${netTotal >= 0 ? "text-secondary" : "text-error"}`}>
            {netTotal >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(netTotal), currency)}
          </p>
        </div>
      </section>

      <div className="mb-lg flex w-full rounded-input bg-surface-low p-1">
        <button
          onClick={() => setTab("spending")}
          className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
            tab === "spending" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"
          }`}
        >
          Spending
        </button>
        <button
          onClick={() => setTab("income")}
          className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
            tab === "income" ? "bg-white text-secondary shadow-sm" : "text-on-surface-variant"
          }`}
        >
          Income
        </button>
      </div>

      {tab === "spending" ? (
        <>
          <section className="mb-xl animate-fade-in">
            <p className="text-sm text-on-surface-variant">Total Spent (7 days)</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(totalExpense, currency)}
            </p>

            <div className="relative mt-md flex h-48 items-end justify-between rounded-input border border-outline-variant p-md">
              {expenseDayTotals.map((amt, i) => (
                <div
                  key={i}
                  className={`w-[12%] rounded-t-sm transition-all ${
                    i === peakIdx && amt > 0 ? "bg-primary" : "bg-sage/20"
                  }`}
                  style={{ height: `${Math.max((amt / maxDay) * 100, 4)}%` }}
                  title={formatCurrency(amt, currency)}
                />
              ))}
            </div>
            <div className="mt-sm flex justify-between text-xs text-on-surface-variant">
              {dayLabels.map((d, i) => (
                <span key={d} className={i === peakIdx ? "font-bold text-primary" : ""}>
                  {d}
                </span>
              ))}
            </div>
          </section>

          <section className="animate-fade-in">
            <h2 className="mb-md text-lg font-bold text-primary">Top Categories</h2>
            <CategoryBreakdown
              categories={expenseCategories}
              total={totalExpense}
              currency={currency}
              emptyLabel="No spending data yet this week."
            />
          </section>
        </>
      ) : (
        <section className="animate-fade-in">
          <p className="text-sm text-on-surface-variant">Total Income (7 days)</p>
          <p className="mb-lg text-3xl font-bold text-secondary">
            {formatCurrency(totalIncome, currency)}
          </p>

          <h2 className="mb-md text-lg font-bold text-primary">Top Sources</h2>
          <CategoryBreakdown
            categories={incomeCategories}
            total={totalIncome}
            currency={currency}
            emptyLabel="No income logged yet this week."
          />
        </section>
      )}
    </>
  );
}

function CategoryBreakdown({
  categories,
  total,
  currency,
  emptyLabel,
}: {
  categories: CategoryTotal[];
  total: number;
  currency?: string | null;
  emptyLabel: string;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-on-surface-variant">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {categories.map(([cat, amt]) => {
        const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">{cat}</span>
              <span className="text-primary">
                {formatCurrency(amt, currency)}{" "}
                <span className="ml-1 text-sm text-on-surface-variant">{pct}%</span>
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
  );
}