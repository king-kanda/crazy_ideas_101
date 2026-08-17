'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { saveAuth, isAuthenticated } from '@/lib/auth';
import { useEffect } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      saveAuth(res.token, res.apiKey, res.storeId);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
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
            PALDA
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
              marginBottom: 24,
              color: 'var(--text)',
            }}
          >
            Sign In
          </h2>

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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 8, padding: '12px 20px' }}
            >
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)' }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
