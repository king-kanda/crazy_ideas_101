'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getAuth, clearAuth, saveAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import Tooltip from '@/components/Tooltip';

// ── Nav item data ──────────────────────────────────────────────

const NAV_ITEMS = [
  {
    href: '/dashboard/demand',
    label: 'Demand',
    tip: 'Search trends, AI-powered gap analysis, and Google Trends cross-reference for your store.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 12l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    href: '/dashboard/store',
    label: 'Store Health',
    tip: 'Cart funnel conversion, top-selling products, and high cart-abandonment products.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="9" width="3" height="6" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="5" width="3" height="10" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="1" width="3" height="14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/activity',
    label: 'Activity',
    tip: 'Visitor traffic patterns — 7-day trend, 24-hour distribution, peak hours, and marketing timing advice.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      </svg>
    ),
  },
];

// ── Helpers ────────────────────────────────────────────────────

function getEmailFromToken(token: string): string {
  try {
    return JSON.parse(atob(token.split('.')[1])).email ?? '';
  } catch {
    return '';
  }
}

function UserAvatar({ email }: { email: string }) {
  const initial = email ? email[0].toUpperCase() : '?';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: '#000',
          fontFamily: 'Syne, sans-serif',
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {email || '—'}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          Store Owner
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────

function Sidebar({
  storeName,
  storeUrl,
  pluginSiteUrl,
  lastSync,
  email,
}: {
  storeName: string;
  storeUrl: string;
  pluginSiteUrl: string | null;
  lastSync: string;
  email: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'var(--ink)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                background: 'var(--accent)',
                display: 'inline-block',
              }}
            />
          </span>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.04em',
            }}
          >
            PALDA
          </div>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Commerce
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 0', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: isActive ? 'rgba(245,158,11,0.06)' : 'transparent',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                textDecoration: 'none',
                transition: 'color 0.12s, background 0.12s',
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <Tooltip text={item.tip} />
            </Link>
          );
        })}
      </nav>

      {/* Settings link */}
      <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
        <Link
          href="/dashboard/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            color: pathname === '/dashboard/settings' ? 'var(--accent)' : 'var(--text-muted)',
            borderLeft: pathname === '/dashboard/settings' ? '2px solid var(--accent)' : '2px solid transparent',
            background: pathname === '/dashboard/settings' ? 'rgba(245,158,11,0.06)' : 'transparent',
            fontSize: 13,
            textDecoration: 'none',
            transition: 'color 0.12s, background 0.12s',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ opacity: pathname === '/dashboard/settings' ? 1 : 0.6 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.06 1.06M11.84 11.84l1.06 1.06M3.1 12.9l1.06-1.06M11.84 4.16l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
          </span>
          Settings
        </Link>
      </div>

      {/* User info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <UserAvatar email={email} />
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border)',
        }}
      >
        {/* Connected store status */}
        <div style={{ marginBottom: 12 }}>
          {storeName && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text)',
                fontWeight: 500,
                letterSpacing: '0.04em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 2,
              }}
            >
              {storeName}
            </div>
          )}
          {storeUrl && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                letterSpacing: '0.03em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 2,
              }}
            >
              {storeUrl.replace(/^https?:\/\//, '')}
            </div>
          )}
          {pluginSiteUrl && storeUrl && pluginSiteUrl.replace(/\/$/, '') !== storeUrl.replace(/\/$/, '') && (
            <Link
              href="/dashboard/settings?tab=store"
              title={`Plugin reports: ${pluginSiteUrl}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 4,
                padding: '3px 7px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: 'var(--danger)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              ⚠ Domain mismatch
            </Link>
          )}
          {lastSync && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-faint)',
                letterSpacing: '0.04em',
                marginTop: 2,
              }}
            >
              Synced {lastSync}
            </div>
          )}
        </div>
        {(pluginSiteUrl || storeUrl) && (
          <a
            href={pluginSiteUrl || storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: '100%',
              padding: '8px 12px',
              marginBottom: 8,
              background: 'transparent',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              cursor: 'pointer',
              textAlign: 'center',
              boxSizing: 'border-box',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(245,158,11,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M7 2H2v12h12V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              <path d="M10 2h4v4M14 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
            VISIT STORE
          </a>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'border-color 0.12s, color 0.12s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--danger)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >
          LOGOUT
        </button>
      </div>
    </aside>
  );
}

// ── Top bar ────────────────────────────────────────────────────

function TopBar({ storeName, lastSync }: { storeName: string; lastSync: string }) {
  const pathname = usePathname();

  const pageTitle =
    pathname.includes('/demand')
      ? 'Demand Intelligence'
      : pathname.includes('/store')
      ? 'Store Health'
      : pathname.includes('/activity')
      ? 'Activity'
      : pathname.includes('/settings')
      ? 'Settings'
      : 'Dashboard';

  return (
    <div
      style={{
        height: 48,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--card)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
        }}
      >
        {pageTitle}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        {lastSync && (
          <span>
            Last sync:{' '}
            <span style={{ color: 'var(--text)' }}>{lastSync}</span>
          </span>
        )}
        {storeName && (
          <span
            style={{
              padding: '3px 8px',
              border: '1px solid var(--border)',
              fontSize: 11,
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
            }}
          >
            {storeName}
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [pluginSiteUrl, setPluginSiteUrl] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState('—');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    const auth = getAuth();
    if (!auth) return;

    if (auth.storeName) setStoreName(auth.storeName);
    if (auth.storeUrl) setStoreUrl(auth.storeUrl);
    const sync = localStorage.getItem('palda_last_sync');
    if (sync) setLastSync(sync);
    setEmail(getEmailFromToken(auth.token));

    api.getProfile(auth.token).then((profile) => {
      setStoreName(profile.storeName);
      setStoreUrl(profile.storeUrl);
      setPluginSiteUrl(profile.pluginSiteUrl);
      saveAuth(auth.token, auth.apiKey, auth.storeId, profile.storeName, profile.storeUrl);
    }).catch(() => {});
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar storeName={storeName} storeUrl={storeUrl} pluginSiteUrl={pluginSiteUrl} lastSync={lastSync} email={email} />
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar storeName={storeName} lastSync={lastSync} />
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}
