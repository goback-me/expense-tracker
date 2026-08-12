"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex flex-1 flex-col px-container-margin pb-lg pt-xl">
      <div className="mb-xl flex flex-col items-center text-center">
        <span className="material-symbols-outlined mb-md text-4xl text-sage">
          lock_reset
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Reset your password
        </h1>
        <p className="mt-sm text-sm text-on-surface-variant">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      {sent ? (
        <p className="text-center text-sm text-on-surface-variant">
          Check {email} for a password reset link.
        </p>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col space-y-md">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-input bg-primary text-sm font-semibold uppercase tracking-wide text-on-primary active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="mt-lg text-center text-sm font-semibold text-sage hover:underline"
      >
        Back to Log In
      </Link>
    </main>
  );
}
