# Google OAuth (Auth.js v5)

Palda Commerce uses [Auth.js v5](https://authjs.dev) (`next-auth@5`) purely as the
**sign-in mechanism** for Google. The single source of truth for the app stays the
FastAPI-issued JWT held in `localStorage` (the existing bearer-token model). On a
successful Google sign-in, the frontend exchanges the Google identity for a Palda
JWT via `POST /auth/oauth`, then persists it with `saveAuth()`.

## Flow

1. User clicks **Continue with Google** on `/login` or `/signup`
   → `signIn('google', { callbackUrl: '/callback' })`.
2. Google redirects back; the Auth.js `jwt` callback (`auth.ts`) POSTs to
   `${NEXT_PUBLIC_API_URL}/auth/oauth` with `{ provider, email, name, provider_account_id }`.
3. The backend finds-or-creates a `Merchant` + `Workspace` (email is the canonical
   key; an existing password account with the same email gets an `oauth_accounts`
   row attached instead of erroring). No `Store` is created for Google signups.
4. The Palda JWT is stashed on the Auth.js session and read client-side at
   `/callback`, which calls `saveAuth()` and routes to:
   - `/onboarding` if the merchant has no store yet (new Google signup), or
   - `/dashboard` if a store is already connected (returning user).

## Environment variables (`shelf-app/.env.local`)

```
AUTH_SECRET=          # npx auth secret  (or: openssl rand -base64 32)
AUTH_GOOGLE_ID=       # Google OAuth client ID
AUTH_GOOGLE_SECRET=   # Google OAuth client secret
# AUTH_URL=https://app.paldacommerce.com   # production origin only
```

## Google Cloud Console setup

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs** — add both:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://<your-prod-domain>/api/auth/callback/google` (production)
4. Copy the **Client ID** → `AUTH_GOOGLE_ID` and **Client secret** → `AUTH_GOOGLE_SECRET`.
5. On the OAuth consent screen, add the `email` and `profile` scopes (default) and
   your test users while the app is unverified.

> Note: this is the **consumer Google login** only. Facebook / Meta login is
> deferred to Phase 2 (Meta Embedded Signup for WhatsApp/IG/FB Page), which shares
> the Meta App Review lane — kept separate on purpose.
