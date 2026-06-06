'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getAuth, clearAuth } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';

// ── Nav item data ──────────────────────────────────────────────

const NAV_ITEMS = [
  {
    href: '/dashboard/demand',
    label: 'Demand',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 12l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    href: '/dashboard/store',
    label: 'Store Health',
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

function Sidebar({ storeName, lastSync, email }: { storeName: string; lastSync: string; email: string }) {
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
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.04em',
          }}
        >
          SHELF
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Buyer Intelligence
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
              {item.label}
            </Link>
          );
        })}
      </nav>

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
        {storeName && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {storeName}
          </div>
        )}
        {lastSync && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-faint)',
              letterSpacing: '0.04em',
              marginBottom: 10,
            }}
          >
            Synced {lastSync}
          </div>
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
  const [lastSync, setLastSync] = useState('—');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    const stored = localStorage.getItem('shelf_store_name');
    if (stored) setStoreName(stored);
    const sync = localStorage.getItem('shelf_last_sync');
    if (sync) setLastSync(sync);
    const token = localStorage.getItem('shelf_token');
    if (token) setEmail(getEmailFromToken(token));
  }, [router]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar storeName={storeName} lastSync={lastSync} email={email} />
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar storeName={storeName} lastSync={lastSync} />
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}
