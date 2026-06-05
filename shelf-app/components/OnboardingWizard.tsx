'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAuth, saveAuth } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────

interface StoreDetails {
  storeName: string;
  storeUrl: string;
  niche: string;
  country: string;
  city: string;
}

// ── Step indicator ─────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--accent)' : 'var(--border)'}`,
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#000' : isDone ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {isDone ? '✓' : step}
            </div>
            {step < total && (
              <div
                style={{
                  width: 48,
                  height: 1,
                  background: isDone ? 'var(--accent)' : 'var(--border)',
                }}
              />
            )}
          </div>
        );
      })}
      <div
        style={{
          marginLeft: 12,
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Step {current} of {total}
      </div>
    </div>
  );
}

// ── Step 1: Store Details ──────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState<StoreDetails>({
    storeName: '',
    storeUrl: '',
    niche: '',
    country: '',
    city: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof StoreDetails, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const email = sessionStorage.getItem('shelf_pending_email');
    const password = sessionStorage.getItem('shelf_pending_password');

    if (!email || !password) {
      setError('Session expired. Please go back and sign up again.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.signup({
        email,
        password,
        store_name: form.storeName,
        store_url: form.storeUrl,
        niche: form.niche || undefined,
        location_country: form.country || undefined,
        location_city: form.city || undefined,
      });
      saveAuth(res.token, res.apiKey, res.storeId);
      sessionStorage.removeItem('shelf_pending_email');
      sessionStorage.removeItem('shelf_pending_password');
      onNext();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const niches = ['Electronics', 'Fashion', 'Furniture', 'Beauty', 'Food', 'Other'];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label className="label" style={{ display: 'block', marginBottom: 6 }}>
          Store Name
        </label>
        <input
          className="input-field"
          placeholder="My Awesome Store"
          value={form.storeName}
          onChange={(e) => set('storeName', e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="label" style={{ display: 'block', marginBottom: 6 }}>
          Store URL
        </label>
        <input
          className="input-field"
          placeholder="https://mystore.com"
          type="url"
          value={form.storeUrl}
          onChange={(e) => set('storeUrl', e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="label" style={{ display: 'block', marginBottom: 8 }}>
          Platform
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              border: '1px solid var(--accent)',
              background: 'rgba(245,158,11,0.08)',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text)',
            }}
          >
            <input
              type="radio"
              name="platform"
              value="woocommerce"
              checked
              readOnly
              style={{ accentColor: 'var(--accent)' }}
            />
            WooCommerce
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              border: '1px solid var(--border)',
              opacity: 0.45,
              fontSize: 13,
              color: 'var(--text-muted)',
              cursor: 'not-allowed',
            }}
          >
            <input type="radio" name="platform" value="shopify" disabled />
            Shopify
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                padding: '1px 5px',
              }}
            >
              Soon
            </span>
          </div>
        </div>
      </div>

      <div>
        <label className="label" style={{ display: 'block', marginBottom: 6 }}>
          Niche / Category
        </label>
        <select
          className="input-field"
          value={form.niche}
          onChange={(e) => set('niche', e.target.value)}
          required
          disabled={loading}
        >
          <option value="" disabled>
            Select niche…
          </option>
          {niches.map((n) => (
            <option key={n} value={n.toLowerCase()}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            Country (ISO)
          </label>
          <input
            className="input-field"
            placeholder="KE"
            maxLength={3}
            value={form.country}
            onChange={(e) => set('country', e.target.value.toUpperCase())}
            disabled={loading}
          />
        </div>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: 6 }}>
            City
          </label>
          <input
            className="input-field"
            placeholder="Nairobi"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid var(--danger)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--danger)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{ width: '100%', padding: '12px 20px', marginTop: 8 }}
      >
        {loading ? 'CREATING ACCOUNT...' : 'CONTINUE →'}
      </button>
    </form>
  );
}

// ── Step 2: API Key & Plugin Setup ─────────────────────────────

function Step2({ onNext }: { onNext: () => void }) {
  const auth = getAuth();
  const apiKey = auth?.apiKey ?? 'sk-shelf-••••••••••••••••';
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  function copyKey() {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleVerify() {
    setError('');
    setVerifying(true);
    try {
      await api.verify(apiKey);
      onNext();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not verify connection. Make sure the plugin is installed and your API key is saved.'
      );
    } finally {
      setVerifying(false);
    }
  }

  const instructions = [
    {
      num: 1,
      text: 'Download the Shelf plugin',
      extra: (
        <a
          href="/api/plugin-download"
          className="btn-outline"
          style={{ display: 'inline-flex', padding: '6px 14px', fontSize: 11, marginTop: 8 }}
        >
          ↓ DOWNLOAD PLUGIN
        </a>
      ),
    },
    { num: 2, text: 'Go to WP Admin → Plugins → Add New → Upload Plugin' },
    { num: 3, text: 'Activate the plugin, then navigate to Shelf → Settings' },
    { num: 4, text: 'Paste your API key into the settings field and click Save' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* API Key box */}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Your API Key
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            border: '1px solid var(--accent)',
            background: 'var(--bg)',
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '12px 14px',
              fontFamily: 'DM Mono, monospace',
              fontSize: 13,
              color: 'var(--accent)',
              letterSpacing: '0.05em',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {apiKey}
          </div>
          <button
            onClick={copyKey}
            style={{
              padding: '12px 16px',
              background: copied ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderLeft: '1px solid var(--accent)',
              color: copied ? '#000' : 'var(--accent)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
          >
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div>
        <div className="label" style={{ marginBottom: 12 }}>
          Plugin Setup Instructions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {instructions.map((ins) => (
            <div
              key={ins.num}
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px 16px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {ins.num}
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{ins.text}</div>
                {ins.extra}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid var(--danger)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--danger)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={verifying}
        className="btn-primary"
        style={{ width: '100%', padding: '12px 20px' }}
      >
        {verifying ? 'VERIFYING CONNECTION...' : "I'VE CONNECTED MY STORE →"}
      </button>
    </div>
  );
}

// ── Step 3: Confirmation ───────────────────────────────────────

function Step3() {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          border: '2px solid var(--success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          color: 'var(--success)',
        }}
      >
        ✓
      </div>

      <div>
        <h2
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--success)',
            marginBottom: 8,
          }}
        >
          Store Connected
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Your WooCommerce store is linked to Shelf.
        </p>
      </div>

      <div
        style={{
          padding: '12px 20px',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          fontSize: 12,
          color: 'var(--text-muted)',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            background: 'var(--accent)',
            animation: 'pulse 1.5s infinite',
          }}
        />
        First sync in progress — data will appear within a few minutes
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        className="btn-primary"
        style={{ padding: '12px 32px' }}
      >
        GO TO DASHBOARD →
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── Wizard shell ───────────────────────────────────────────────

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);

  const stepLabels = ['Store Details', 'Plugin Setup', 'Confirmation'];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--accent)',
              letterSpacing: '-0.04em',
              marginBottom: 4,
            }}
          >
            SHELF
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Setup Wizard
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={3} />

        {/* Step card */}
        <div className="card" style={{ padding: 32 }}>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 24,
              color: 'var(--text)',
              paddingBottom: 16,
              borderBottom: '1px solid var(--border)',
            }}
          >
            {stepLabels[step - 1]}
          </h2>

          {step === 1 && <Step1 onNext={() => setStep(2)} />}
          {step === 2 && <Step2 onNext={() => setStep(3)} />}
          {step === 3 && <Step3 />}
        </div>
      </div>
    </div>
  );
}
