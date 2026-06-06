'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { ActivityResponse } from '@/lib/api';
import ActivityHeatmap from '@/components/ActivityHeatmap';

type Period = 'day' | 'week' | 'month';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day',   label: 'Day' },
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
];

// ── Mock data ──────────────────────────────────────────────────

function buildMockHourly() {
  const pattern = [
    12, 8, 6, 5, 5, 7, 18, 42, 78, 110, 132, 148,
    155, 142, 138, 144, 160, 188, 210, 195, 172, 140, 98, 54,
  ];
  return pattern.map((v, i) => ({
    hour: i,
    activeUsers: v + Math.floor(Math.random() * 10),
  }));
}

function buildMockDaily() {
  const base = [142, 158, 136, 171, 189, 204, 197];
  const today = new Date();
  return base.map((v, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return {
      date: d.toISOString().split('T')[0],
      activeUsers: v,
      pageViews: v * 3 + Math.floor(Math.random() * 50),
    };
  });
}

const MOCK_DATA: ActivityResponse = {
  hourly: buildMockHourly(),
  daily: buildMockDaily(),
  peakHours: [
    { hour: 18, activeUsers: 210, label: 'Evening rush — post-work browsing' },
    { hour: 19, activeUsers: 195, label: 'Sustained evening traffic' },
    { hour: 12, activeUsers: 155, label: 'Lunch break spike' },
    { hour: 20, activeUsers: 172, label: 'Prime shopping window' },
  ],
  totalUniqueVisitors: 4287,
  generatedAt: new Date().toISOString(),
};

// ── Page ───────────────────────────────────────────────────────

export default function ActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('week');

  const load = useCallback(async (p: Period) => {
    const auth = getAuth();
    if (!auth) { setError('Not authenticated.'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.activity(auth.storeId, auth.apiKey, p);
      setData(res);
      setError('');
    } catch {
      setData(MOCK_DATA);
      setError('API unavailable — showing demo data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

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
          Loading Activity Data...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Period filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)' }}>
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              style={{
                padding: '7px 20px',
                background: period === value ? 'var(--accent)' : 'transparent',
                color: period === value ? '#000' : 'var(--text-muted)',
                border: 'none',
                borderRight: value !== 'month' ? '1px solid var(--border)' : 'none',
                fontSize: 11,
                fontWeight: period === value ? 700 : 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 12, border: '1.5px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading...
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: '10px 14px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11, color: 'var(--text-muted)' }}>
          ⚠ {error}
        </div>
      )}
      {data && <ActivityHeatmap data={data} period={period} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
