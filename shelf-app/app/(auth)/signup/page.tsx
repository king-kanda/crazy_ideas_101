'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    sessionStorage.setItem('shelf_pending_email', email);
    sessionStorage.setItem('shelf_pending_password', password);
    router.push('/onboarding');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--accent)',
              letterSpacing: '-0.04em',
            }}
          >
            SHELF
          </span>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Buyer Intelligence
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 4,
              color: 'var(--text)',
            }}
          >
            Create Account
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
            You'll set up your store details on the next step.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="you@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: 8, padding: '12px 20px' }}
            >
              CONTINUE →
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
