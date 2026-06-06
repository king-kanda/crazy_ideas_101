'use client';

import { useState, useEffect } from 'react';
import { getAuth, saveAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const PLUGIN_URL =
  'https://github.com/king-kanda/crazy_ideas_101/blob/claude/inspiring-lamport-OoZhC/shelf-woocommerce.zip';

const STEPS = [
  'Download the plugin zip using the button above.',
  'In your WordPress admin go to Plugins → Add New → Upload Plugin.',
  'Choose the downloaded zip file and click Install Now.',
  'Activate the plugin, then open Shelf → Settings in the WP Admin sidebar.',
  'Paste your API key into the API Key field and click Save.',
  'The plugin will start syncing products, searches, and cart events automatically.',
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      style={{
        padding: '6px 14px',
        background: 'transparent',
        border: '1px solid var(--border)',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        borderColor: copied ? 'var(--success)' : 'var(--border)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        fontFamily: 'DM Mono, monospace',
        flexShrink: 0,
      }}
    >
      {copied ? '✓ COPIED' : 'COPY'}
    </button>
  );
}

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [regenConfirm, setRegenConfirm] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (auth) {
      setApiKey(auth.apiKey);
      setToken(auth.token);
    }
  }, []);

  const maskedKey = apiKey
    ? apiKey.slice(0, 8) + '••••••••-••••-••••-••••-' + apiKey.slice(-4)
    : '';

  async function handleRegenerate() {
    if (!regenConfirm) {
      setRegenConfirm(true);
      return;
    }
    setRegenerating(true);
    setRegenError('');
    setRegenConfirm(false);
    try {
      const { apiKey: newKey } = await api.regenerateKey(token);
      const auth = getAuth()!;
      saveAuth(auth.token, newKey, auth.storeId);
      setApiKey(newKey);
      setRevealed(true);
    } catch (err: unknown) {
      setRegenError(err instanceof Error ? err.message : 'Failed to regenerate key.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* API Key */}
      <div className="card" style={{ padding: 28 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>
          API Key
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          This key authenticates your WooCommerce plugin with the Shelf API. Keep it secret — anyone
          with this key can send data to your account.
        </p>

        {/* Key display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            padding: '10px 14px',
            marginBottom: 14,
          }}
        >
          <code
            style={{
              flex: 1,
              fontSize: 12,
              color: 'var(--text)',
              fontFamily: 'DM Mono, monospace',
              letterSpacing: '0.04em',
              wordBreak: 'break-all',
            }}
          >
            {revealed ? apiKey : maskedKey}
          </code>
          <button
            onClick={() => setRevealed((v) => !v)}
            title={revealed ? 'Hide' : 'Reveal'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            {revealed ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </button>
          <CopyButton text={apiKey} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={regenConfirm ? 'btn-primary' : 'btn-outline'}
            style={{ fontSize: 11, padding: '8px 16px' }}
          >
            {regenerating
              ? 'REGENERATING...'
              : regenConfirm
              ? '⚠ CONFIRM — OLD KEY WILL STOP WORKING'
              : 'REGENERATE KEY'}
          </button>
          {regenConfirm && (
            <button
              onClick={() => setRegenConfirm(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              CANCEL
            </button>
          )}
        </div>
        {regenError && <div className="error-msg" style={{ marginTop: 10 }}>{regenError}</div>}
      </div>

      {/* Plugin installation */}
      <div className="card" style={{ padding: 28 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>
          Plugin Installation
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Install the Shelf WooCommerce plugin on your WordPress store to start collecting buyer
          intelligence. You need WordPress 6.0+ and WooCommerce 7.0+.
        </p>

        <a
          href={PLUGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ display: 'inline-flex', fontSize: 11, padding: '9px 18px', marginBottom: 28, textDecoration: 'none' }}
        >
          ↓ DOWNLOAD SHELF PLUGIN
        </a>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'DM Mono, monospace',
                }}
              >
                {i + 1}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Key reminder */}
        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
          }}
        >
          <div className="label" style={{ marginBottom: 8, color: 'var(--accent)' }}>
            Your API Key
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <code style={{ flex: 1, fontSize: 11, color: 'var(--text)', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>
              {revealed ? apiKey : maskedKey}
            </code>
            <CopyButton text={apiKey} />
          </div>
        </div>
      </div>

    </div>
  );
}
