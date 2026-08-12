"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-container-margin text-center">
        <span className="material-symbols-outlined mb-md text-5xl text-sage">
          mark_email_read
        </span>
        <h1 className="text-xl font-bold text-primary">Check your email</h1>
        <p className="mt-sm text-sm text-on-surface-variant">
          We sent a confirmation link to {email}. Verify your email, then log in.
        </p>
        <Link
          href="/login"
          className="mt-lg h-12 w-full rounded-input bg-primary flex items-center justify-center text-sm font-semibold uppercase tracking-wide text-on-primary"
        >
          Back to Log In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-container-margin pb-lg pt-xl">
      <div className="mb-xl flex flex-col items-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Create account
        </h1>
        <p className="mt-sm text-sm text-on-surface-variant">
          Start tracking receipts in seconds.
        </p>
      </div>

      <form onSubmit={handleSignup} className="flex w-full flex-col space-y-md">
        <div className="flex flex-col">
          <label className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Full Name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Johnson"
            className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base tracking-widest outline-none focus:border-primary"
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-md h-12 rounded-input bg-primary text-sm font-semibold uppercase tracking-wide text-on-primary active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p className="mt-lg text-center text-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-sage hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
