'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DemandResponse } from '@/lib/api';
import GapAlert from './GapAlert';

interface Props {
  data: DemandResponse;
}

// ── Custom tooltip ─────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--text)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div>
        Score: <span style={{ color: 'var(--accent)' }}>{payload[0].value}</span>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function DemandGaps({ data }: Props) {
  const { topSearches = [], trendingKeywords = [], demandGaps = [] } = data ?? {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* 1. Top Searches */}
      <section>
        <div className="section-header">
          <span>Top Searches</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
            {topSearches.length} queries
          </span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Query</th>
                <th style={{ textAlign: 'right' }}>Count</th>
                <th style={{ textAlign: 'center' }}>Results</th>
              </tr>
            </thead>
            <tbody>
              {topSearches.map((row, i) => (
                <tr key={row.query}>
                  <td style={{ color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{row.query}</td>
                  <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{row.count.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    {row.zeroResults ? (
                      <span className="badge badge-danger">0 Results</span>
                    ) : (
                      <span className="badge badge-muted">Results</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Trending Keywords chart */}
      <section>
        <div className="section-header">
          <span>Trending Keywords</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
            Interest score
          </span>
        </div>
        <div className="card" style={{ paddingTop: 24, paddingBottom: 8 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={trendingKeywords}
              margin={{ top: 4, right: 8, left: -12, bottom: 4 }}
              barCategoryGap="30%"
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="keyword"
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(245,158,11,0.06)' }} />
              <Bar dataKey="score" fill="var(--accent)" radius={0} />
            </BarChart>
          </ResponsiveContainer>

          {/* Delta indicators below chart */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
            }}
          >
            {trendingKeywords.map((kw) => (
              <div
                key={kw.keyword}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                <span>{kw.keyword}</span>
                <span
                  style={{
                    color: kw.delta >= 0 ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 600,
                  }}
                >
                  {kw.delta >= 0 ? '+' : ''}
                  {kw.delta}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Demand Gaps */}
      <section>
        <div className="section-header">
          <span>Demand Gaps</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
            {demandGaps.filter((g) => g.severity === 'high').length} high priority
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {demandGaps.length === 0 && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
                border: '1px solid var(--border)',
              }}
            >
              No demand gaps detected in this period.
            </div>
          )}
          {demandGaps.map((gap) => (
            <GapAlert key={gap.id} signal={gap.signal} severity={gap.severity} />
          ))}
        </div>
      </section>
    </div>
  );
}
