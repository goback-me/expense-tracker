"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { getCurrencySymbol, DEFAULT_CURRENCY } from "@/lib/currency";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";

type Item = { name: string; price: number };
type Direction = "expense" | "income";
type ReceiptType = "purchase" | "transfer";

export default function NewReceiptPage() {
  const router = useRouter();
  const supabase = createClient();

  const [direction, setDirection] = useState<Direction>("expense");
  const [receiptType, setReceiptType] = useState<ReceiptType>("purchase");
  const [storeName, setStoreName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [items, setItems] = useState<Item[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol(DEFAULT_CURRENCY));

  useEffect(() => {
    const draft = sessionStorage.getItem("receiptDraft");
    const preview = sessionStorage.getItem("receiptImagePreview");

    if (draft) {
      const parsed = JSON.parse(draft);
      const type: ReceiptType = parsed.receipt_type === "transfer" ? "transfer" : "purchase";
      const dir: Direction = parsed.direction === "income" ? "income" : "expense";

      setDirection(dir);
      setReceiptType(type);
      setStoreName(parsed.store_name || "");
      setDate(parsed.date || new Date().toISOString().slice(0, 10));
      setAmount(String(parsed.total_amount ?? ""));
      setCategory(parsed.category || (dir === "income" ? "Other Income" : "Other"));
      setItems(parsed.items || []);
      setPaymentMethod(parsed.payment_method || "");
      setCounterparty(parsed.counterparty || "");
      setReferenceNo(parsed.reference_no || "");
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      // Support /receipts/new?type=income from the "Add Income" quick action
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("type") === "income") {
          setDirection("income");
          setCategory("Other Income");
        }
      }
    }

    if (preview) setImagePreview(preview);

    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrencySymbol(getCurrencySymbol(user?.user_metadata?.currency));
    });
  }, [supabase]);

  function switchDirection(d: Direction) {
    setDirection(d);
    setCategory(d === "income" ? "Other Income" : "Other");
  }

  function switchType(type: ReceiptType) {
    setReceiptType(type);
    setCategory(
      type === "transfer" ? "Transfer" : direction === "income" ? "Other Income" : "Other"
    );
  }

  async function handleSave() {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    let thumbnailUrl: string | null = null;

    if (imagePreview && imagePreview.startsWith("blob:")) {
      const blob = await fetch(imagePreview).then((r) => r.blob());
      const path = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, blob, { contentType: "image/jpeg" });

      // Store the bare path, not a permanent public URL — the bucket is
      // private, so a signed (time-limited) URL gets generated whenever
      // the image is actually displayed instead.
      if (!uploadError) {
        thumbnailUrl = path;
      }
    }

    const isTransfer = receiptType === "transfer";

    // For transfers, build a readable display name from method + counterparty
    // e.g. "JazzCash — Ali Raza". For income, storeName doubles as "Source".
    const displayName = isTransfer
      ? [paymentMethod.trim(), counterparty.trim()].filter(Boolean).join(" — ") ||
        "Transfer"
      : storeName || (direction === "income" ? "Income" : "Expense");

    const { error } = await supabase.from("receipts").insert({
      user_id: user.id,
      store_name: displayName,
      purchased_at: date,
      amount: parseFloat(amount) || 0,
      category,
      items: isTransfer || direction === "income" ? [] : items,
      thumbnail_url: thumbnailUrl,
      direction,
      receipt_type: receiptType,
      payment_method: isTransfer ? paymentMethod || null : null,
      counterparty: isTransfer ? counterparty || null : null,
      reference_no: isTransfer ? referenceNo || null : null,
    });

    setSaving(false);

    if (error) {
      alert("Couldn't save: " + error.message);
      return;
    }

    sessionStorage.removeItem("receiptDraft");
    sessionStorage.removeItem("receiptImagePreview");

    router.push("/receipts");
  }

  const isTransfer = receiptType === "transfer";

  const canSave = isTransfer
    ? !!paymentMethod && !!amount
    : !!storeName && !!amount;

  const categoryOptions = direction === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <TopBar
        title={isTransfer ? "Confirm Transfer" : "Confirm Details"}
        rightIcon={saving ? undefined : "save"}
        onRightClick={handleSave}
      />
      <main className="flex-1 overflow-y-auto px-container-margin pt-md pb-32 no-scrollbar">
        {imagePreview && (
          <div className="mb-lg h-32 w-full overflow-hidden rounded-input border border-outline-variant">
            <Image
              src={imagePreview}
              alt="Scanned receipt"
              width={400}
              height={128}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Top-level Expense / Income toggle */}
        <div className="mb-md flex w-full rounded-input bg-surface-low p-1">
          <button
            onClick={() => switchDirection("expense")}
            className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
              direction === "expense"
                ? "bg-white text-primary shadow-sm"
                : "text-on-surface-variant"
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => switchDirection("income")}
            className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
              direction === "income"
                ? "bg-white text-secondary shadow-sm"
                : "text-on-surface-variant"
            }`}
          >
            Income
          </button>
        </div>

        {/* Purchase / Transfer sub-toggle */}
        <div className="mb-lg flex w-full rounded-input bg-surface-low p-1">
            <button
              onClick={() => switchType("purchase")}
              className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
                receiptType === "purchase"
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant"
              }`}
            >
              Purchase
            </button>
            <button
              onClick={() => switchType("transfer")}
              className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
                receiptType === "transfer"
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant"
              }`}
            >
              Bank / Wallet Transfer
            </button>
          </div>

        <div className="mb-lg space-y-sm">
          {isTransfer ? (
            <>
              <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
                <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Payment Method
                </label>
                <input
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="e.g. JazzCash, Easypaisa, HBL Bank"
                  className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
                />
              </div>
              <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
                <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Sender / Recipient
                </label>
                <input
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="Who the money went to or came from"
                  className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
                />
              </div>
              <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
                <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Reference / Transaction No.
                </label>
                <input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Optional"
                  className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
                />
              </div>
            </>
          ) : (
            <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
              <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {direction === "income" ? "Source" : "Store Name"}
              </label>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={
                  direction === "income"
                    ? "e.g. Company Salary, Client Payment"
                    : "e.g. Imtiaz Super Market"
                }
                className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
              />
            </div>
          )}

          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
            />
          </div>

          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {direction === "income" ? "Amount Received" : "Total Amount"}
            </label>
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
          </div>

          {!isTransfer && (
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
          )}
        </div>

        {direction === "expense" && receiptType === "purchase" && items.length > 0 && (
          <div className="mb-xl overflow-hidden rounded-input border border-outline-variant">
            <button
              onClick={() => setShowItems((v) => !v)}
              className="flex w-full items-center justify-between border-b border-outline-variant bg-white p-md text-left font-semibold text-primary"
            >
              <span>Itemized List ({items.length})</span>
              <span
                className="material-symbols-outlined text-on-surface-variant transition-transform"
                style={{ transform: showItems ? "rotate(180deg)" : "none" }}
              >
                expand_more
              </span>
            </button>
            {showItems && (
              <ul className="animate-fade-in divide-y divide-outline-variant bg-white">
                {items.map((item, i) => (
                  <li key={i} className="flex justify-between p-md text-sm">
                    <span className="text-primary">{item.name}</span>
                    <span className="text-primary">
                      {currencySymbol} {item.price.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-outline-variant bg-background p-container-margin">
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="w-full rounded-input bg-primary py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Saving..." : direction === "income" ? "Save Income" : "Save Receipt"}
        </button>
      </div>
    </>
  );
}