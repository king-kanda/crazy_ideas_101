'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuth, saveAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { StoreProfile } from '@/lib/api';

const PLUGIN_URL =
  'https://github.com/king-kanda/crazy_ideas_101/blob/claude/inspiring-lamport-OoZhC/shelf-woocommerce.zip';

const INSTALL_STEPS = [
  'Download the plugin zip using the button above.',
  'In your WordPress admin go to Plugins → Add New → Upload Plugin.',
  'Choose the downloaded zip file and click Install Now.',
  'Activate the plugin, then open Shelf → Settings in the WP Admin sidebar.',
  'Paste your API key into the API Key field and click Save.',
  'The plugin will start syncing products, searches, and cart events automatically.',
];

// ── Copy button ────────────────────────────────────────────────

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

// ── Tab: API Key ───────────────────────────────────────────────

function ApiKeyTab({ apiKey, token }: { apiKey: string; token: string }) {
  const [revealed, setRevealed] = useState(false);
  const [key, setKey] = useState(apiKey);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [regenConfirm, setRegenConfirm] = useState(false);

  const maskedKey = key
    ? key.slice(0, 8) + '••••••••-••••-••••-••••-' + key.slice(-4)
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
      saveAuth(auth.token, newKey, auth.storeId, auth.storeName, auth.storeUrl);
      setKey(newKey);
      setRevealed(true);
    } catch (err: unknown) {
      setRegenError(err instanceof Error ? err.message : 'Failed to regenerate key.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="card" style={{ padding: 28 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>API Key</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          This key authenticates your WooCommerce plugin with the Shelf API. Keep it secret — anyone
          with this key can send data to your account.
        </p>

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
            {revealed ? key : maskedKey}
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
          <CopyButton text={key} />
        </div>

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
    </div>
  );
}

// ── Tab: Plugin ────────────────────────────────────────────────

function PluginTab({ apiKey }: { apiKey: string }) {
  const [revealed, setRevealed] = useState(false);
  const maskedKey = apiKey
    ? apiKey.slice(0, 8) + '••••••••-••••-••••-••••-' + apiKey.slice(-4)
    : '';

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="card" style={{ padding: 28 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>Plugin Installation</div>
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
          {INSTALL_STEPS.map((step, i) => (
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

        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
          }}
        >
          <div className="label" style={{ marginBottom: 8, color: 'var(--accent)' }}>Your API Key</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <code style={{ flex: 1, fontSize: 11, color: 'var(--text)', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>
              {revealed ? apiKey : maskedKey}
            </code>
            <button
              onClick={() => setRevealed((v) => !v)}
              title={revealed ? 'Hide' : 'Reveal'}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
            >
              {revealed ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>
            <CopyButton text={apiKey} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Store Settings ────────────────────────────────────────

const NICHES = ['Electronics', 'Fashion', 'Furniture', 'Beauty', 'Food', 'Other'];

function StoreTab({ token }: { token: string }) {
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [form, setForm] = useState({
    storeName: '',
    storeUrl: '',
    niche: '',
    locationCountry: '',
    locationCity: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile(token)
      .then((p) => {
        setProfile(p);
        setForm({
          storeName: p.storeName,
          storeUrl: p.storeUrl,
          niche: p.niche ?? '',
          locationCountry: p.locationCountry ?? '',
          locationCity: p.locationCity ?? '',
        });
      })
      .catch(() => setError('Could not load store settings.'))
      .finally(() => setLoading(false));
  }, [token]);

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api.updateProfile(token, form);
      setProfile(updated);
      const auth = getAuth()!;
      saveAuth(auth.token, auth.apiKey, auth.storeId, updated.storeName, updated.storeUrl);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', padding: '32px 0' }}>
        LOADING...
      </div>
    );
  }

  const hasMismatch =
    profile?.pluginSiteUrl &&
    profile.pluginSiteUrl.replace(/\/$/, '') !== profile.storeUrl.replace(/\/$/, '');

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Domain mismatch warning */}
      {hasMismatch && (
        <div
          style={{
            padding: '14px 16px',
            border: '1px solid rgba(239,68,68,0.5)',
            background: 'rgba(239,68,68,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', letterSpacing: '0.04em' }}>
            ⚠ Domain mismatch detected
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Your registered store URL is <strong style={{ color: 'var(--text)' }}>{profile?.storeUrl}</strong> but the
            connected plugin is reporting <strong style={{ color: 'var(--text)' }}>{profile?.pluginSiteUrl}</strong>.
            Update the Store URL below to match your WordPress site.
          </div>
        </div>
      )}

      {/* Plugin connection status */}
      <div className="card" style={{ padding: 20 }}>
        <div className="label" style={{ marginBottom: 12 }}>Plugin Connection</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: profile?.pluginSiteUrl ? 'var(--success)' : 'var(--text-faint)',
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 12, color: 'var(--text)' }}>
            {profile?.pluginSiteUrl ? (
              <>
                Connected from{' '}
                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>
                  {profile.pluginSiteUrl}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No plugin data received yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Editable store details */}
      <div className="card" style={{ padding: 28 }}>
        <div className="section-header" style={{ marginBottom: 20 }}>Store Details</div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Store Name</label>
            <input
              className="input-field"
              value={form.storeName}
              onChange={(e) => set('storeName', e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>
              Store URL
              {hasMismatch && (
                <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>
                  ⚠ doesn&apos;t match plugin
                </span>
              )}
            </label>
            <input
              className="input-field"
              type="url"
              value={form.storeUrl}
              onChange={(e) => set('storeUrl', e.target.value)}
              required
              disabled={saving}
              style={hasMismatch ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}
            />
            {hasMismatch && (
              <button
                type="button"
                onClick={() => set('storeUrl', profile?.pluginSiteUrl ?? '')}
                style={{
                  marginTop: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'DM Mono, monospace',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: 0,
                }}
              >
                ← Use plugin URL
              </button>
            )}
          </div>

          <div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>Niche / Category</label>
            <select
              className="input-field"
              value={form.niche}
              onChange={(e) => set('niche', e.target.value)}
              disabled={saving}
            >
              <option value="">Select niche…</option>
              {NICHES.map((n) => (
                <option key={n} value={n.toLowerCase()}>{n}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Country (ISO)</label>
              <input
                className="input-field"
                placeholder="KE"
                maxLength={3}
                value={form.locationCountry}
                onChange={(e) => set('locationCountry', e.target.value.toUpperCase())}
                disabled={saving}
              />
            </div>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>City</label>
              <input
                className="input-field"
                placeholder="Nairobi"
                value={form.locationCity}
                onChange={(e) => set('locationCity', e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', border: '1px solid var(--danger)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ fontSize: 11, padding: '9px 20px' }}
            >
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
            {saved && (
              <span style={{ fontSize: 11, color: 'var(--success)', letterSpacing: '0.06em' }}>
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab: Labs ──────────────────────────────────────────────────

type CheckStatus = 'idle' | 'loading' | 'ok' | 'error';

interface CheckResult {
  status: CheckStatus;
  detail: string;
  meta?: string;
}

function StatusDot({ status }: { status: CheckStatus }) {
  const color =
    status === 'ok' ? 'var(--success)' :
    status === 'error' ? 'var(--danger)' :
    status === 'loading' ? 'var(--accent)' :
    'var(--border)';
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    />
  );
}

function LabCheck({
  label,
  description,
  result,
  onRun,
}: {
  label: string;
  description: string;
  result: CheckResult;
  onRun: () => void;
}) {
  return (
    <div
      className="card"
      style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot status={result.status} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
              {label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
              {description}
            </div>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={result.status === 'loading'}
          className="btn-outline"
          style={{ fontSize: 10, padding: '6px 14px', flexShrink: 0, letterSpacing: '0.08em' }}
        >
          {result.status === 'loading' ? 'TESTING...' : 'RUN TEST'}
        </button>
      </div>

      {result.status !== 'idle' && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg)',
            border: `1px solid ${result.status === 'ok' ? 'rgba(34,197,94,0.25)' : result.status === 'error' ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
            fontSize: 11,
            fontFamily: 'DM Mono, monospace',
            color: result.status === 'ok' ? 'var(--success)' : result.status === 'error' ? 'var(--danger)' : 'var(--text-muted)',
            lineHeight: 1.7,
          }}
        >
          <div>{result.detail}</div>
          {result.meta && (
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{result.meta}</div>
          )}
        </div>
      )}
    </div>
  );
}

function LabsTab({ token }: { token: string }) {
  const [groq, setGroq] = useState<CheckResult>({ status: 'idle', detail: '' });
  const [celery, setCelery] = useState<CheckResult>({ status: 'idle', detail: '' });
  const [trends, setTrends] = useState<CheckResult>({ status: 'idle', detail: '' });

  async function runGroq() {
    setGroq({ status: 'loading', detail: '' });
    try {
      const r = await api.labs.groq(token);
      if (r.ok) {
        setGroq({
          status: 'ok',
          detail: `Connected — model: ${r.model}`,
          meta: `Response: "${r.response}" · ${r.response_time_ms}ms`,
        });
      } else {
        setGroq({ status: 'error', detail: r.error ?? 'Unknown error' });
      }
    } catch (e) {
      setGroq({ status: 'error', detail: e instanceof Error ? e.message : 'Request failed' });
    }
  }

  async function runCelery() {
    setCelery({ status: 'loading', detail: '' });
    try {
      const r = await api.labs.celery(token);
      if (r.ok) {
        setCelery({
          status: 'ok',
          detail: `${r.count} worker${r.count !== 1 ? 's' : ''} online`,
          meta: r.workers?.join(', '),
        });
      } else {
        setCelery({ status: 'error', detail: r.error ?? 'Unknown error' });
      }
    } catch (e) {
      setCelery({ status: 'error', detail: e instanceof Error ? e.message : 'Request failed' });
    }
  }

  async function runTrends() {
    setTrends({ status: 'loading', detail: '' });
    try {
      const r = await api.labs.trends(token);
      if (r.ok) {
        setTrends({
          status: 'ok',
          detail: `Google Trends reachable`,
          meta: `keyword: "${r.keyword}" · geo: ${r.geo} · avg interest: ${r.avg_interest} · ${r.response_time_ms}ms`,
        });
      } else {
        setTrends({ status: 'error', detail: r.error ?? 'Unknown error' });
      }
    } catch (e) {
      setTrends({ status: 'error', detail: e instanceof Error ? e.message : 'Request failed' });
    }
  }

  async function runAll() {
    await Promise.all([runGroq(), runCelery(), runTrends()]);
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Verify that each backend service is reachable and correctly configured.
        </p>
        <button onClick={runAll} className="btn-outline" style={{ fontSize: 10, padding: '7px 16px', flexShrink: 0, marginLeft: 16 }}>
          RUN ALL
        </button>
      </div>

      <LabCheck
        label="Groq LLM"
        description="Calls llama-3.3-70b-versatile via GROQ_API_KEY. Powers demand gap analysis."
        result={groq}
        onRun={runGroq}
      />
      <LabCheck
        label="Celery Workers"
        description="Pings active Celery workers via REDIS_URL broker. Required for background tasks."
        result={celery}
        onRun={runCelery}
      />
      <LabCheck
        label="Google Trends"
        description="Fetches live trend data via pytrends. Used daily by the Celery trend worker."
        result={trends}
        onRun={runTrends}
      />
    </div>
  );
}

// ── Settings page ──────────────────────────────────────────────

const TABS = [
  { id: 'apikey', label: 'API KEY' },
  { id: 'plugin', label: 'PLUGIN' },
  { id: 'store', label: 'STORE' },
  { id: 'labs', label: 'LABS' },
] as const;

type TabId = typeof TABS[number]['id'];

function SettingsInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) ?? 'apikey';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'apikey',
  );
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const auth = getAuth();
    if (auth) {
      setApiKey(auth.apiKey);
      setToken(auth.token);
    }
  }, []);

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 28,
          gap: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              transition: 'color 0.12s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'apikey' && <ApiKeyTab apiKey={apiKey} token={token} />}
      {activeTab === 'plugin' && <PluginTab apiKey={apiKey} />}
      {activeTab === 'store' && token && <StoreTab token={token} />}
      {activeTab === 'labs' && token && <LabsTab token={token} />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>LOADING...</div>}>
      <SettingsInner />
    </Suspense>
  );
}
