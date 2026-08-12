import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";

export default async function ReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!receipt) notFound();

  const items: { name: string; price: number }[] = receipt.items || [];

  return (
    <>
      <TopBar title="Receipt" />
      <main className="flex-1 overflow-y-auto px-container-margin pt-md pb-24 no-scrollbar">
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
          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Store Name
            </p>
            <p className="text-base font-medium text-primary">
              {receipt.store_name}
            </p>
          </div>
          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Date
            </p>
            <p className="text-base font-medium text-primary">
              {new Date(receipt.purchased_at).toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="rounded-input border border-outline-variant bg-surface-low px-md py-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Total Amount
            </p>
            <p className="text-lg font-bold text-primary">
              ${Number(receipt.amount).toFixed(2)}
            </p>
          </div>
          <div className="mt-md flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Category
            </span>
            <span className="rounded-lg bg-sage/20 px-3 py-1 text-xs font-semibold text-secondary">
              {receipt.category}
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <div className="overflow-hidden rounded-input border border-outline-variant">
            <div className="border-b border-outline-variant bg-white p-md font-semibold text-primary">
              Itemized List ({items.length})
            </div>
            <ul className="divide-y divide-outline-variant bg-white">
              {items.map((item, i) => (
                <li key={i} className="flex justify-between p-md text-sm">
                  <span className="text-primary">{item.name}</span>
                  <span className="text-primary">${item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
