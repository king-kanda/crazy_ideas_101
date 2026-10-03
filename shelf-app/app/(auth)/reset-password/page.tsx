'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email);
      // API always returns 200 (no user enumeration). dev_token is only present
      // while transactional email is deferred (PRD: no user-facing email in MVP).
      setDevToken(res.devToken);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <span
            className="text-3xl font-extrabold tracking-tight text-foreground"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            PALDA
          </span>
          <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Buyer Intelligence
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Syne, sans-serif' }}>Reset password</CardTitle>
            <CardDescription>
              {submitted
                ? "If an account exists for that email, we've generated a reset link."
                : 'Enter your account email and we’ll send you a reset link.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {submitted ? (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground">
                  Email delivery isn’t enabled yet in this build. Use the link below to set a
                  new password.
                </p>
                {devToken ? (
                  <Button asChild className="w-full">
                    <Link href={`/reset-password/confirm?token=${encodeURIComponent(devToken)}`}>
                      Set a new password
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No matching account was found for that email.
                  </p>
                )}
                <Link
                  href="/login"
                  className="text-center text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@store.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {error && <div className="text-xs text-destructive">{error}</div>}

                <Button type="submit" disabled={loading} className="mt-2 w-full">
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>

                <Link
                  href="/login"
                  className="text-center text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                >
                  Back to sign in
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
