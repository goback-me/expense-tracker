"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";

type Item = { name: string; price: number };

const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Tech",
  "Other",
];

export default function NewReceiptPage() {
  const router = useRouter();
  const supabase = createClient();

  const [storeName, setStoreName] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [items, setItems] = useState<Item[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const draft = sessionStorage.getItem("receiptDraft");
    const preview = sessionStorage.getItem("receiptImagePreview");

    if (draft) {
      const parsed = JSON.parse(draft);
      setStoreName(parsed.store_name || "");
      setDate(parsed.date || new Date().toISOString().slice(0, 10));
      setAmount(String(parsed.total_amount ?? ""));
      setCategory(parsed.category || "Other");
      setItems(parsed.items || []);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
    }

    if (preview) setImagePreview(preview);
  }, []);

  async function handleSave() {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    let thumbnailUrl: string | null = null;

    // Upload the receipt image to Supabase Storage if we have one
    if (imagePreview && imagePreview.startsWith("blob:")) {
      const blob = await fetch(imagePreview).then((r) => r.blob());
      const path = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, blob, { contentType: "image/jpeg" });

      if (!uploadError) {
        const { data } = supabase.storage.from("receipts").getPublicUrl(path);
        thumbnailUrl = data.publicUrl;
      }
    }

    const { error } = await supabase.from("receipts").insert({
      user_id: user.id,
      store_name: storeName,
      purchased_at: date,
      amount: parseFloat(amount) || 0,
      category,
      items,
      thumbnail_url: thumbnailUrl,
    });

    setSaving(false);

    if (error) {
      alert("Couldn't save receipt: " + error.message);
      return;
    }

    sessionStorage.removeItem("receiptDraft");
    sessionStorage.removeItem("receiptImagePreview");

    router.push("/receipts");
  }

  return (
    <>
      <TopBar
        title="Confirm Details"
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

        <div className="mb-lg space-y-sm">
          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <label className="mb-xs block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Store Name
            </label>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border-none bg-transparent p-0 text-base font-medium text-primary outline-none"
            />
          </div>

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
              Total Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border-none bg-transparent p-0 text-lg font-bold text-primary outline-none"
            />
          </div>

          <div className="mt-md flex flex-wrap items-center gap-2">
            <span className="mr-sm text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Category
            </span>
            {CATEGORIES.map((c) => (
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
        </div>

        {items.length > 0 && (
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
                    <span className="text-primary">${item.price.toFixed(2)}</span>
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
          disabled={saving || !storeName || !amount}
          className="w-full rounded-input bg-primary py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Receipt"}
        </button>
      </div>
    </>
  );
}