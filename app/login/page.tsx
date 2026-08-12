"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col px-container-margin pb-lg pt-xl">
      <div className="mb-xl mt-xl flex flex-col items-center justify-center">
        <div className="mb-md flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-low">
          <span
            className="material-symbols-outlined text-4xl text-sage"
            style={{ fontVariationSettings: "'wght' 200" }}
          >
            receipt_long
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          Receiptly
        </h1>
        <p className="mt-sm text-sm text-on-surface-variant">
          Effortless financial record-keeping.
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex w-full flex-col space-y-md">
        <div className="flex flex-col">
          <label
            htmlFor="email"
            className="mb-xs text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-12 rounded-input border border-outline-variant bg-surface px-md text-base text-on-surface outline-none transition-colors focus:border-primary"
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-xs flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-input border border-outline-variant bg-surface px-md text-base tracking-widest text-on-surface outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility" : "visibility_off"}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-md flex h-12 w-full items-center justify-center rounded-input bg-primary text-sm font-semibold uppercase tracking-wide text-on-primary transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <div className="my-xl flex items-center">
        <div className="h-px flex-1 bg-outline-variant" />
        <span className="px-md text-sm text-on-surface-variant">or</span>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

      <p className="mt-auto pb-md text-center text-sm text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-sage hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
