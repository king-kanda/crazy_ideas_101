import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://shelf-7a6211a30e15.herokuapp.com';

/**
 * Auth.js v5 (NextAuth) is the *sign-in mechanism* only — the single source of
 * truth for the app stays the FastAPI-issued JWT (bearer token in localStorage).
 * On Google sign-in we exchange the verified Google identity for a Palda JWT via
 * `POST /auth/oauth`, stash it on the NextAuth token, and surface it on the
 * session so the client bridge (`/auth/callback`) can `saveAuth()` it.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Only runs with `account` present on the initial sign-in.
      if (account?.provider === 'google' && profile?.email) {
        try {
          const res = await fetch(`${API_URL}/auth/oauth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'google',
              email: profile.email,
              name: profile.name ?? null,
              provider_account_id: account.providerAccountId,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            token.palda = {
              token: data.token,
              apiKey: data.api_key,
              storeId: data.store_id,
              workspaceId: data.workspace_id,
              merchantId: data.merchant_id,
            };
          } else {
            token.paldaError = `oauth exchange failed (${res.status})`;
          }
        } catch {
          token.paldaError = 'oauth exchange unreachable';
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.palda = token.palda;
      session.paldaError = token.paldaError;
      return session;
    },
  },
});
