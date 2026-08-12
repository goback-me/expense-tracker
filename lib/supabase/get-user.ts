import { headers } from "next/headers";
import { createClient } from "./server";

export type CachedUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
};

/**
 * Reads the user that middleware.ts already verified with Supabase Auth and
 * attached to the request as a header. This avoids a second network
 * round-trip to Supabase Auth on every single page load — middleware did
 * that work once already, so pages just read the result instead of asking
 * again.
 *
 * Falls back to a live auth.getUser() call only if the header is missing
 * (e.g. this ever runs outside middleware's matcher).
 */
export async function getCachedUser(): Promise<CachedUser | null> {
  const raw = headers().get("x-user-data");

  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // Malformed header — fall through to a real lookup below.
    }
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return { id: user.id, email: user.email, user_metadata: user.user_metadata };
}