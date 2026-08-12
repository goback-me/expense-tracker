# Receiptly

Personal receipt & expense tracker. Mobile-first, installable as a home-screen app (PWA). Built with Next.js 14, Supabase (auth + DB + storage), and Gemini for receipt OCR.

## Screens included

- Login / Signup (Supabase email+password auth)
- Forgot password / Reset password
- Home dashboard (this month's spend, quick actions, recent receipts)
- Scan (real camera capture via `getUserMedia`, or upload from gallery) → Gemini OCR
- Confirm/edit extracted receipt details → saves to Supabase
- All receipts (filterable by category, grouped by date)
- Single receipt detail
- Reports (weekly spend chart, top categories)
- Settings (profile, **Security & Password** change, logout)

## 1. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → Run.
   This creates the `receipts` table, turns on **Row Level Security** (so
   users can only ever see their own data), and sets up a `receipts` storage
   bucket with per-user folder policies.
3. Go to **Settings → API** and copy your Project URL and anon public key.
4. Go to **Authentication → Providers** and make sure Email is enabled.
   (Optional: enable Google OAuth here too later.)

## 2. Get a Gemini API key (free)

Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey), create a key. No card required on the free tier.

## 3. Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste in your Supabase URL/key + Gemini key
npm run dev
```

Open http://localhost:3000 — resize your browser to mobile width, or open dev tools device toolbar, to preview it as a phone screen.

## 4. Deploy to Vercel (free)

```bash
git init
git add .
git commit -m "Initial Receiptly build"
git remote add origin https://github.com/goback-me/receiptly.git
git push -u origin main
```

Then in [vercel.com](https://vercel.com):
1. Import the GitHub repo.
2. Add the same 3 environment variables from `.env.local` in Vercel's project settings (Settings → Environment Variables).
3. Deploy. You'll get a live URL like `receiptly.vercel.app`.

## 5. Install on your phone

1. Open your Vercel URL in mobile Safari (iOS) or Chrome (Android).
2. Tap the Share button (iOS) or menu (Android) → **Add to Home Screen**.
3. It now opens full-screen with its own icon, like a native app — no browser bar, no App Store needed.

## Security notes

- Every receipt row is protected by Supabase **Row Level Security** — even
  if someone got your database URL, they could not read another user's
  receipts without their auth token.
- Receipt images are stored in a private-by-folder Storage bucket; each
  user can only read/write inside their own `{user_id}/` folder.
- The Gemini API key never reaches the browser — the `/api/ocr` route runs
  server-side only, and it also checks that a Supabase session exists
  before calling Gemini.
- `middleware.ts` redirects unauthenticated visitors to `/login` for every
  route except login/signup.

## What's still a placeholder

- **App Lock / biometric unlock** (Settings → Security) is stubbed with an
  explanation — wiring up WebAuthn/Face ID for a PWA is a further step, say
  if you want it built out.
- **Google OAuth button** on login isn't wired up yet — enable the Google
  provider in Supabase Auth settings, then it's a two-line addition.
- App icons in `public/icons/` are auto-generated placeholders — swap them
  for real branded icons whenever you like (192×192 and 512×512 PNG).
