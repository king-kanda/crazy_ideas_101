'use client';

import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function ConfirmForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'This reset link is invalid or has expired.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Syne, sans-serif' }}>Invalid link</CardTitle>
          <CardDescription>This reset link is missing its token.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/reset-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontFamily: 'Syne, sans-serif' }}>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {done ? (
          <div className="text-sm text-foreground">
            Password updated. Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                New password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Confirm password
              </label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className="text-xs text-destructive">{error}</div>}

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordConfirmPage() {
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
        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading…</div>}>
          <ConfirmForm />
        </Suspense>
      </div>
    </div>
  );
}
