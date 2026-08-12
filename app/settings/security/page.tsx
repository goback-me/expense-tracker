"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/TopBar";

export default function SecurityPage() {
  const supabase = createClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    // Re-authenticate with current password first for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (reauthError) {
      setError("Current password is incorrect.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <>
      <TopBar title="Security & Password" />
      <main className="flex-1 overflow-y-auto px-container-margin pt-lg pb-24 no-scrollbar">
        <section className="mb-xl">
          <h2 className="mb-md text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            Change Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-md">
            <input
              type="password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-12 w-full rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-12 w-full rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 w-full rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
            />

            {error && <p className="text-sm text-error">{error}</p>}
            {success && (
              <p className="text-sm text-secondary">Password updated successfully.</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-input bg-primary text-sm font-semibold uppercase tracking-wide text-on-primary active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        <section className="space-y-sm">
          <h2 className="mb-md text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            Device Security
          </h2>
          <div className="overflow-hidden rounded-card border border-outline-variant bg-surface">
            <div className="flex items-center justify-between border-b border-outline-variant p-md">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-primary">
                  fingerprint
                </span>
                <div>
                  <p className="text-base text-primary">App Lock</p>
                  <p className="text-xs text-on-surface-variant">
                    Require Face ID / fingerprint to open Receiptly
                  </p>
                </div>
              </div>
            </div>
            <p className="p-md text-xs text-on-surface-variant">
              Biometric lock uses your device&apos;s built-in Face ID / fingerprint
              via the WebAuthn API once configured. Toggle coming in the next
              build.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
