'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ActivityResponse } from '@/lib/api';

interface Props {
  data: ActivityResponse;
}

function fmt12h(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
}) {
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
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{fmt12h(Number(label))}</div>
      <div>
        Active users: <span style={{ color: 'var(--accent)' }}>{payload[0].value}</span>
      </div>
    </div>
  );
}

export default function ActivityHeatmap({ data }: Props) {
  const { hourly = [], peakHours = [], totalUniqueVisitors = 0 } = data ?? {};

  const maxUsers = Math.max(...hourly.map((h) => h.activeUsers), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, border: '1px solid var(--border)' }}>
        <div
          className="card"
          style={{ border: 'none', borderRight: '1px solid var(--border)', padding: '16px 20px' }}
        >
          <div className="stat-value">{totalUniqueVisitors.toLocaleString()}</div>
          <div className="stat-label">Unique Visitors (24h)</div>
        </div>
        <div
          className="card"
          style={{ border: 'none', borderRight: '1px solid var(--border)', padding: '16px 20px' }}
        >
          <div className="stat-value">{peakHours.length > 0 ? fmt12h(peakHours[0].hour) : '—'}</div>
          <div className="stat-label">Peak Hour</div>
        </div>
        <div className="card" style={{ border: 'none', padding: '16px 20px' }}>
          <div className="stat-value">
            {peakHours.length > 0 ? peakHours[0].activeUsers.toLocaleString() : '—'}
          </div>
          <div className="stat-label">Peak Concurrent Users</div>
        </div>
      </div>

      {/* 24hr bar chart */}
      <section>
        <div className="section-header">
          <span>24-Hour Activity</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
            Active users per hour
          </span>
        </div>
        <div className="card" style={{ paddingTop: 24, paddingBottom: 8 }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourly} margin={{ top: 4, right: 8, left: -12, bottom: 4 }} barCategoryGap="20%">
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="hour"
                tickFormatter={fmt12h}
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(245,158,11,0.06)' }} />
              <Bar dataKey="activeUsers" radius={0}>
                {hourly.map((entry) => {
                  const isPeak = peakHours.some((p) => p.hour === entry.hour);
                  const intensity = entry.activeUsers / maxUsers;
                  return (
                    <Cell
                      key={`cell-${entry.hour}`}
                      fill={isPeak ? 'var(--accent)' : `rgba(245,158,11,${0.25 + intensity * 0.45})`}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Peak hour callout cards */}
      {peakHours.length > 0 && (
        <section>
          <div className="section-header">
            <span>Peak Hours</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {peakHours.map((peak, i) => (
              <div
                key={peak.hour}
                style={{
                  padding: '16px 18px',
                  background: 'var(--card)',
                  border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                  position: 'relative',
                }}
              >
                {i === 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      padding: '1px 5px',
                    }}
                  >
                    PEAK
                  </div>
                )}
                <div
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 22,
                    fontWeight: 400,
                    color: i === 0 ? 'var(--accent)' : 'var(--text)',
                    marginBottom: 4,
                  }}
                >
                  {fmt12h(peak.hour)}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                  }}
                >
                  {peak.activeUsers.toLocaleString()} users
                </div>
                {peak.label && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {peak.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
