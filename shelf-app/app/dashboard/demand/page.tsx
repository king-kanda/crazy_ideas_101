'use client';

import { useEffect, useState } from 'react';
import { getAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { DemandResponse } from '@/lib/api';
import DemandGaps from '@/components/DemandGaps';

// ── Mock fallback data (shown when API is unavailable) ─────────

const MOCK_DATA: DemandResponse = {
  topSearches: [
    { query: 'wireless earbuds', count: 1240, zeroResults: false },
    { query: 'noise cancelling headphones', count: 892, zeroResults: false },
    { query: 'standing desk converter', count: 671, zeroResults: true },
    { query: 'mechanical keyboard tkl', count: 543, zeroResults: true },
    { query: 'usb-c hub 10 port', count: 498, zeroResults: true },
    { query: 'webcam 4k streaming', count: 420, zeroResults: false },
    { query: 'monitor arm dual', count: 387, zeroResults: false },
    { query: 'ergonomic mouse vertical', count: 312, zeroResults: false },
  ],
  trendingKeywords: [
    { keyword: 'earbuds', score: 94, delta: 28 },
    { keyword: 'mechanical kb', score: 78, delta: 15 },
    { keyword: 'standing desk', score: 67, delta: -4 },
    { keyword: 'webcam', score: 61, delta: 42 },
    { keyword: 'usb hub', score: 55, delta: 8 },
    { keyword: 'monitor arm', score: 44, delta: -2 },
  ],
  demandGaps: [
    {
      id: '1',
      signal: '543 visitors searched "mechanical keyboard tkl" in the last 7 days — no matching products in catalog.',
      severity: 'high',
      category: 'keyboards',
    },
    {
      id: '2',
      signal: '"USB-C hub 10 port" searched 498 times. Your hub listings top out at 7 ports — demand for 10-port hubs unmet.',
      severity: 'high',
      category: 'hubs',
    },
    {
      id: '3',
      signal: '"Standing desk converter" has 671 searches with zero results. Consider adding height-adjustable desktop risers.',
      severity: 'high',
      category: 'furniture',
    },
    {
      id: '4',
      signal: 'Webcam searches up 42% WoW. Current stock levels may not meet projected demand spike.',
      severity: 'medium',
      category: 'cameras',
    },
    {
      id: '5',
      signal: '"Ergonomic mouse" queries growing steadily — vertical mouse variants account for 60% of those searches.',
      severity: 'low',
      category: 'peripherals',
    },
  ],
  generatedAt: new Date().toISOString(),
};

// ── Page ───────────────────────────────────────────────────────

export default function DemandPage() {
  const [data, setData] = useState<DemandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const auth = getAuth();
      if (!auth) { setError('Not authenticated.'); setLoading(false); return; }

      try {
        const res = await api.demand(auth.storeId, auth.apiKey);
        setData(res);
        // Cache last sync time
        localStorage.setItem('shelf_last_sync', 'just now');
      } catch {
        // Show mock data with a notice when API is unavailable
        setData(MOCK_DATA);
        setError('API unavailable — showing demo data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          gap: 16,
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Loading Demand Data...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          style={{
            marginBottom: 20,
            padding: '10px 14px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}
        >
          ⚠ {error}
        </div>
      )}
      {data && <DemandGaps data={data} />}
    </div>
  );
}
