import Link from "next/link";
import { getCachedUser } from "@/lib/supabase/get-user";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import { DEFAULT_CURRENCY, getCurrencySymbol } from "@/lib/currency";

export default async function SettingsPage() {
  const user = await getCachedUser();

  const name = user?.user_metadata?.full_name || "Your Account";
  const email = user?.email || "";
  const initial = name[0]?.toUpperCase() || "?";

  const currencyCode = user?.user_metadata?.currency || DEFAULT_CURRENCY;
  const currencyDisplay = `${currencyCode} (${getCurrencySymbol(currencyCode)})`;

  return (
    <>
      <header className="safe-top sticky top-0 z-40 flex h-16 items-center justify-center border-b border-outline-variant bg-background px-container-margin">
        <h1 className="text-lg font-bold tracking-tight text-primary">
          Receiptly
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-container-margin pt-lg pb-24 space-y-xl no-scrollbar">
        <div className="flex items-center gap-md rounded-card border border-outline-variant bg-surface p-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-high text-xl font-bold text-primary">
            {initial}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-primary">{name}</h2>
            <p className="text-sm text-on-surface-variant">{email}</p>
          </div>
        </div>

        <section className="space-y-sm">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Account
          </h3>
          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface">
            <SettingsRow icon="person" label="Personal Information" href="/settings/profile" />
            <SettingsRow
              icon="verified_user"
              label="Security &amp; Password"
              href="/settings/security"
              last
            />
          </div>
        </section>

        <section className="space-y-sm">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Preferences
          </h3>
          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface">
            <SettingsRow
              icon="payments"
              label="Default Currency"
              value={currencyDisplay}
              href="/settings/currency"
            />
            <SettingsRow icon="download" label="Export Data" last />
          </div>
        </section>

        <section className="space-y-sm">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Support
          </h3>
          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface">
            <SettingsRow icon="help" label="Help Center" />
            <SettingsRow icon="info" label="About Receiptly" last />
          </div>
        </section>

        <LogoutButton />

        <p className="pb-md text-center text-xs text-outline">
          Version 1.0.0
        </p>
      </main>
      <BottomNav />
    </>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  href,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  href?: string;
  last?: boolean;
}) {
  const content = (
    <div
      className={`flex items-center justify-between p-md ${
        last ? "" : "border-b border-outline-variant"
      }`}
    >
      <div className="flex items-center gap-md">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <span className="text-base text-primary">{label}</span>
      </div>
      <div className="flex items-center gap-sm text-on-surface-variant">
        {value && <span className="text-sm">{value}</span>}
        <span className="material-symbols-outlined">chevron_right</span>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block active:bg-surface-low">
      {content}
    </Link>
  ) : (
    <button className="block w-full text-left active:bg-surface-low">
      {content}
    </button>
  );
}