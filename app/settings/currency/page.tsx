"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from "@/lib/currency";

export default function CurrencySettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [selected, setSelected] = useState<string>(DEFAULT_CURRENCY);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSelected(user?.user_metadata?.currency || DEFAULT_CURRENCY);
      setLoaded(true);
    });
  }, [supabase]);

  async function handleSelect(code: string) {
    setSelected(code);
    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: { currency: code },
    });

    setSaving(false);

    if (error) {
      alert("Couldn't save currency: " + error.message);
      return;
    }

    // Refresh so every server-rendered screen (Home, Receipts, Reports)
    // picks up the new currency immediately.
    router.push("/settings");
    router.refresh();
  }

  return (
    <>
      <TopBar title="Default Currency" />
      <main className="flex-1 overflow-y-auto px-container-margin pt-lg pb-24 no-scrollbar">
        {!loaded ? (
          <p className="text-sm text-on-surface-variant">Loading...</p>
        ) : (
          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface">
            {CURRENCY_OPTIONS.map((c, i) => (
              <button
                key={c.code}
                onClick={() => handleSelect(c.code)}
                disabled={saving}
                className={`flex w-full items-center justify-between p-md text-left transition-colors active:bg-surface-low disabled:opacity-60 ${
                  i !== CURRENCY_OPTIONS.length - 1
                    ? "border-b border-outline-variant"
                    : ""
                }`}
              >
                <div className="flex items-center gap-md">
                  <span className="w-10 shrink-0 font-semibold text-primary">
                    {c.symbol}
                  </span>
                  <div>
                    <p className="text-base text-primary">{c.label}</p>
                    <p className="text-xs text-on-surface-variant">{c.code}</p>
                  </div>
                </div>
                {selected === c.code && (
                  <span className="material-symbols-outlined text-secondary">
                    check_circle
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}