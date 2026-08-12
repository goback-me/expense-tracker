"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/login");
  }

  return (
    <main className="flex flex-1 flex-col px-container-margin pb-lg pt-xl">
      <div className="mb-xl flex flex-col items-center text-center">
        <span className="material-symbols-outlined mb-md text-4xl text-sage">
          password
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          Set new password
        </h1>
      </div>

      <form onSubmit={handleUpdate} className="flex flex-col space-y-md">
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base tracking-widest outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base tracking-widest outline-none focus:border-primary"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-input bg-primary text-sm font-semibold uppercase tracking-wide text-on-primary active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </main>
  );
}
