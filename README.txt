# tellari-web-starter (Next.js + Supabase)

## 0) Prereqs
- Node 18+
- Your Supabase project URL + anon key
- `user_profiles` table created (the SQL you already ran)
- A test user created under Authentication → Users, and a row in `user_profiles` for that user's UUID

## 1) Create a Next.js app
```bash
npx create-next-app@latest tellari-web --ts --eslint
cd tellari-web
npm i @supabase/supabase-js @supabase/auth-helpers-nextjs
```

## 2) Drop these starter files in
- Copy `app/` and `lib/` from this zip into your new Next.js project (overwriting if asked)
- Copy `.env.local.example` to `.env.local` and fill in values

## 3) Fill env
Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 4) Run
```bash
npm run dev
```
- Visit http://localhost:3000/login → sign in with your test user
- Then go to http://localhost:3000/profile → should show that user's `user_profiles` row (RLS-protected)
