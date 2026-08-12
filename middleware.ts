import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Buffer any cookie mutations Supabase wants to make (e.g. refreshed
  // session tokens) instead of writing them to a response immediately —
  // we don't create the final response until after we know the user and
  // have set the x-user-data header, so this avoids losing cookie writes.
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookiesToSet.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          cookiesToSet.push({ name, value: "", options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Not logged in and trying to hit a protected page -> send to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    cookiesToSet.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set({ name, value, ...options })
    );
    return redirectResponse;
  }

  // Logged in and trying to hit login/signup -> send to home
  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectResponse = NextResponse.redirect(url);
    cookiesToSet.forEach(({ name, value, options }) =>
      redirectResponse.cookies.set({ name, value, ...options })
    );
    return redirectResponse;
  }

  // Pass the already-verified user downstream via a request header so pages
  // don't need to call Supabase Auth a second time — this is the main fix
  // for the multi-second navigation lag (see lib/supabase/get-user.ts).
  if (user) {
    requestHeaders.set(
      "x-user-data",
      JSON.stringify({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      })
    );
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToSet.forEach(({ name, value, options }) =>
    response.cookies.set({ name, value, ...options })
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)",
  ],
};