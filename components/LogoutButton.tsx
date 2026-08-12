"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-card border border-[#f5b8b1] bg-error-container p-md text-left active:bg-[#fcdcd9]"
    >
      <div className="flex items-center gap-md">
        <span className="material-symbols-outlined text-error">logout</span>
        <span className="font-medium text-error">Log Out</span>
      </div>
    </button>
  );
}
