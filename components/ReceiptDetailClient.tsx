"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";

type Item = { name: string; price: number };

type ReceiptRow = {
  id: string;
  store_name: string;
  amount: number;
  category: string;
  purchased_at: string;
  thumbnail_url: string | null;
  receipt_type: "purchase" | "transfer" | "income" | null;
  direction: "expense" | "income" | null;
  payment_method: string | null;
  counterparty: string | null;
  reference_no: string | null;
  items: Item[] | null;
};

export default function ReceiptDetailClient({
  receipt: initialReceipt,
  currency,
}: {
  receipt: ReceiptRow;
  currency?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [receipt, setReceipt] = useState(initialReceipt);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isTransfer = receipt.receipt_type === "transfer";
  const isIncome = receipt.direction === "income";
  const items: Item[] = receipt.items || [];
  const currencySymbol = getCurrencySymbol(currency);

  // Edit form state
  const [storeName, setStoreName] = useState(receipt.store_name);
  const [paymentMethod, setPaymentMethod] = useState(receipt.payment_method || "");
  const [counterparty, setCounterparty] = useState(receipt.counterparty || "");
  const [referenceNo, setReferenceNo] = useState(receipt.reference_no || "");
  const [date, setDate] = useState(receipt.purchased_at.slice(0, 10));
  const [amount, setAmount] = useState(String(receipt.amount));
  const [category, setCategory] = useState(receipt.category);

  const categoryOptions = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function startEditing() {
    setStoreName(receipt.store_name);
    setPaymentMethod(receipt.payment_method || "");
    setCounterparty(receipt.counterparty || "");
    setReferenceNo(receipt.reference_no || "");
    setDate(receipt.purchased_at.slice(0, 10));
    setAmount(String(receipt.amount));
    setCategory(receipt.category);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);

    const displayName = isTransfer
      ? [paymentMethod.trim(), counterparty.trim()].filter(Boolean).join(" — ") ||
        "Transfer"
      : storeName.trim() || receipt.store_name;

    const updates = {
      store_name: displayName,
      purchased_at: date,
      amount: parseFloat(amount) || 0,
      category,
      payment_method: isTransfer ? paymentMethod || null : null,
      counterparty: isTransfer ? counterparty || null : null,
      reference_no: isTransfer ? referenceNo || null : null,
    };

    const { error } = await supabase
      .from("receipts")
      .update(updates)
      .eq("id", receipt.id);

    setSaving(false);

    if (error) {
      alert("Couldn't save changes: " + error.message);
      return;
    }

    setReceipt({ ...receipt, ...updates });
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);

    // Best-effort cleanup of the stored image — non-blocking, since the
    // receipt row is what actually matters. If this fails silently, an
    // orphaned file in Storage costs nothing meaningful.
    if (receipt.thumbnail_url) {
      try {
        const marker = "/receipts/";
        const idx = receipt.thumbnail_url.indexOf(marker);
        if (idx !== -1) {
          const path = receipt.thumbnail_url.slice(idx + marker.length);
          await supabase.storage.from("receipts").remove([path]);
        }
      } catch {
        // Non-critical — ignore.
      }
    }

    const { error } = await supabase.from("receipts").delete().eq("id", receipt.id);

    setDeleting(false);

    if (error) {
      alert("Couldn't delete: " + error.message);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/receipts");
    router.refresh();
  }

  return (
    <>
      {/* Custom header — needs two right-side actions (edit + delete), which
          the shared TopBar component doesn't support. */}
      <header className="safe-top sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-background px-container-margin">
        <button
          onClick={() => (editing ? setEditing(false) : router.back())}
          aria-label={editing ? "Cancel editing" : "Back"}
          className="flex items-center justify-center p-2 -ml-2 active:opacity-70"
        >
          <span className="material-symbols-outlined text-primary">
            {editing ? "close" : "arrow_back"}
          </span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-primary">
          {editing ? "Edit" : isTransfer ? "Transfer" : "Receipt"}
        </h1>
        {editing ? (
          <div className="w-6" />
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={startEditing}
              aria-label="Edit"
              className="flex items-center justify-center p-2 active:opacity-70"
            >
              <span className="material-symbols-outlined text-primary">edit</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete"
              className="flex items-center justify-center p-2 -mr-2 active:opacity-70"
            >
              <span className="material-symbols-outlined text-error">delete</span>
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-container-margin pt-md pb-32 no-scrollbar">
        {receipt.thumbnail_url && (
          <div className="mb-lg h-40 w-full overflow-hidden rounded-input border border-outline-variant">
            <Image
              src={receipt.thumbnail_url}
              alt={receipt.store_name}
              width={400}
              height={160}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="mb-lg space-y-sm">
          {isTransfer ? (
            <>
              <Field
                label="Payment Method"
                value={paymentMethod}
                display={receipt.payment_method}
                editing={editing}
                onChange={setPaymentMethod}
                placeholder="e.g. JazzCash, HBL Bank"
              />
              <Field
                label="Sender / Recipient"
                value={counterparty}
                display={receipt.counterparty}
                editing={editing}
                onChange={setCounterparty}
                placeholder="Who the money went to or came from"
              />
              {(editing || receipt.reference_no) && (
                <Field
                  label="Reference / Transaction No."
                  value={referenceNo}
                  display={receipt.reference_no}
                  editing={editing}
                  onChange={setReferenceNo}
                  placeholder="Optional"
                />
              )}
            </>
          ) : (
            <Field
              label="Store Name"
              value={storeName}
              display={receipt.store_name}
              editing={editing}
              onChange={setStoreName}
            />
          )}

          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Date
            </p>
            {editing ? (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
              />
            ) : (
              <p className="text-base font-medium text-primary">
                {new Date(receipt.purchased_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Total Amount
            </p>
            {editing ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-on-surface-variant">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border-none bg-transparent p-0 text-lg font-bold text-primary outline-none"
                />
              </div>
            ) : (
              <p className="text-lg font-bold text-primary">
                {formatCurrency(Number(receipt.amount), currency)}
              </p>
            )}
          </div>

          {editing ? (
            <div className="mt-md flex flex-wrap items-center gap-2">
              <span className="mr-sm text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Category
              </span>
              {categoryOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all active:scale-95 ${
                    category === c
                      ? "bg-sage/20 text-secondary"
                      : "bg-surface-low text-on-surface-variant"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-md flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Category
              </span>
              <span className="rounded-lg bg-sage/20 px-3 py-1 text-xs font-semibold text-secondary">
                {receipt.category}
              </span>
            </div>
          )}
        </div>

        {!isTransfer && items.length > 0 && (
          <div className="overflow-hidden rounded-input border border-outline-variant">
            <div className="border-b border-outline-variant bg-white p-md font-semibold text-primary">
              Itemized List ({items.length})
            </div>
            <ul className="divide-y divide-outline-variant bg-white">
              {items.map((item, i) => (
                <li key={i} className="flex justify-between p-md text-sm">
                  <span className="text-primary">{item.name}</span>
                  <span className="text-primary">
                    {formatCurrency(item.price, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {editing && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-outline-variant bg-background p-container-margin">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-input bg-primary py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Delete confirmation — requires an explicit second tap on the
          destructive action, so an accidental first tap can't delete
          anything by itself. */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-lg sm:rounded-2xl">
            <div className="mb-md flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-error">
                warning
              </span>
              <h2 className="text-lg font-bold text-primary">Delete this entry?</h2>
            </div>
            <p className="mb-lg text-sm text-on-surface-variant">
              This will permanently remove &ldquo;{receipt.store_name}&rdquo; (
              {formatCurrency(Number(receipt.amount), currency)}). This can&apos;t be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-input border border-outline-variant py-3 text-sm font-semibold text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-input bg-error py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  display,
  editing,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  display: string | null;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
      <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
        />
      ) : (
        <p className="text-base font-medium text-primary">{display || "—"}</p>
      )}
    </div>
  );
}