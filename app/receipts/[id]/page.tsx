import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/get-user";
import ReceiptDetailClient from "@/components/ReceiptDetailClient";

export default async function ReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const user = await getCachedUser();
  const currency = user?.user_metadata?.currency;

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!receipt) notFound();

  return <ReceiptDetailClient receipt={receipt} currency={currency} />;
}