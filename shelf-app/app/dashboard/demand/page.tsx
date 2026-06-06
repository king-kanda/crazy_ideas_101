'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { DemandResponse } from '@/lib/api';
import DemandGaps from '@/components/DemandGaps';

// ── Mock fallback ──────────────────────────────────────────────

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
    { id: '1', signal: '543 visitors searched "mechanical keyboard tkl" — no matching products in catalog.', severity: 'high', category: 'keyboards' },
    { id: '2', signal: '"USB-C hub 10 port" searched 498 times. Your hub listings top out at 7 ports — demand unmet.', severity: 'high', category: 'hubs' },
    { id: '3', signal: '"Standing desk converter" has 671 searches with zero results. Consider desktop height-adjustable risers.', severity: 'high', category: 'furniture' },
    { id: '4', signal: 'Webcam searches up 42% WoW. Current stock may not meet projected demand spike.', severity: 'medium', category: 'cameras' },
    { id: '5', signal: '"Ergonomic mouse" queries growing — vertical mouse variants account for 60% of those searches.', severity: 'low', category: 'peripherals' },
  ],
  generatedAt: new Date().toISOString(),
};

// ── Page ───────────────────────────────────────────────────────

export default function DemandPage() {
  const [data, setData] = useState<DemandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (silent = false) => {
    const auth = getAuth();
    if (!auth) {
      setNotice('Not authenticated.');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await api.demand(auth.storeId, auth.apiKey);
      setData(res);
      localStorage.setItem('shelf_last_sync', 'just now');
      setNotice('');
    } catch {
      setData(MOCK_DATA);
      setNotice('API unavailable — showing demo data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRunAnalysis() {
    const auth = getAuth();
    if (!auth) return;
    setRefreshing(true);
    setNotice('');
    try {
      const res = await api.refreshDemand(auth.storeId, auth.token);
      setData(res);
      localStorage.setItem('shelf_last_sync', 'just now');
      setNotice(`Analysis complete — trends refreshed for your store location and categories.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Analysis failed. Try again.');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, color: 'var(--text-muted)' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading Demand Data...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Header row with Run Analysis button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {data?.generatedAt
            ? `Last run: ${new Date(data.generatedAt).toLocaleString()}`
            : 'No analysis yet'}
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={refreshing}
          className="btn-primary"
          style={{ fontSize: 10, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          {refreshing ? (
            <>
              <div style={{ width: 10, height: 10, border: '1.5px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              RUNNING ANALYSIS...
            </>
          ) : (
            '↻ RUN ANALYSIS'
          )}
        </button>
      </div>

      {refreshing && (
        <div style={{ marginBottom: 16, padding: '10px 14px', border: '1px solid var(--accent)', background: 'rgba(245,158,11,0.06)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
          Refreshing Google Trends for your store location and categories, then running LLM gap analysis… this may take 10–20 seconds.
        </div>
      )}

      {notice && !refreshing && (
        <div style={{ marginBottom: 16, padding: '10px 14px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {notice.startsWith('Analysis') ? '✓ ' : '⚠ '}{notice}
        </div>
      )}

      {data && <DemandGaps data={data} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
