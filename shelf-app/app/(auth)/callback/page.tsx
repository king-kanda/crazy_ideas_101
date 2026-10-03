'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth-context';

/**
 * OAuth bridge: NextAuth handled the Google handshake and (via the jwt callback)
 * exchanged it for a Palda JWT exposed on the session. Here — client-side, where
 * localStorage exists — we persist it with the app's bearer-token model and route
 * onward. New Google accounts have no store yet, so they land in onboarding.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { setAuth } = useAuth();
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (status === 'loading' || done.current) return;

    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    if (session?.paldaError) {
      done.current = true;
      setError('We could not finish signing you in. Please try again.');
      return;
    }

    const palda = session?.palda;
    if (palda?.token) {
      done.current = true;
      setAuth({
        token: palda.token,
        workspaceId: palda.workspaceId,
        merchantId: palda.merchantId,
        apiKey: palda.apiKey || undefined,
        storeId: palda.storeId || undefined,
      });
      // No connected store → send them through onboarding to link one.
      router.replace(palda.storeId ? '/dashboard' : '/onboarding');
    }
  }, [session, status, setAuth, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <div className="text-sm text-destructive">{error}</div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs font-semibold text-foreground underline underline-offset-2"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Signing you in…</div>
        )}
      </div>
    </div>
  );
}
