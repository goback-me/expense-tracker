"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/TopBar";

export default function ProfilePage() {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setName(user?.user_metadata?.full_name || "");
      setEmail(user?.email || "");
    });
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    await supabase.auth.updateUser({ data: { full_name: name } });

    setLoading(false);
    setSaved(true);
  }

  return (
    <>
      <TopBar title="Personal Information" />
      <main className="flex-1 px-container-margin pt-lg pb-24">
        <form onSubmit={handleSave} className="space-y-md">
          <div className="flex flex-col">
            <label className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Email
            </label>
            <input
              value={email}
              disabled
              className="h-12 rounded-input border border-outline-variant bg-surface-low px-md text-base text-on-surface-variant outline-none"
            />
            <p className="mt-xs text-xs text-on-surface-variant">
              Contact support to change your email address.
            </p>
          </div>

          {saved && <p className="text-sm text-secondary">Saved.</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-input bg-primary text-sm font-semibold uppercase tracking-wide text-on-primary active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </main>
    </>
  );
}
