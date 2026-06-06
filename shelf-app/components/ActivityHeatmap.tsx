'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ActivityResponse } from '@/lib/api';
import Tooltip from './Tooltip';

interface Props {
  data: ActivityResponse;
  period?: 'day' | 'week' | 'month';
}

function fmt12h(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function HourlyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{fmt12h(Number(label))}</div>
      <div>Active users: <span style={{ color: 'var(--accent)' }}>{payload[0].value}</span></div>
    </div>
  );
}

function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label ? fmtDate(label) : ''}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{p.name}</span>
          <span style={{ color: p.color, fontFamily: 'DM Mono, monospace' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Which block (0=night, 1=morning, 2=afternoon, 3=evening) each hour belongs to
const BLOCK_LABELS = ['Night (11pm–5am)', 'Morning (6am–11am)', 'Afternoon (12pm–5pm)', 'Evening (6pm–10pm)'];
function hourBlock(h: number): number {
  if (h >= 6 && h <= 11) return 1;
  if (h >= 12 && h <= 17) return 2;
  if (h >= 18 && h <= 22) return 3;
  return 0; // night
}

function getMarketingTips(peakHour: number, dailyTrend: 'rising' | 'falling' | 'stable'): string[] {
  const tips: string[] = [];
  const block = hourBlock(peakHour);

  if (block === 1) {
    tips.push('Schedule email campaigns 30–60 min before morning peak to catch inboxes before browsing starts.');
    tips.push('Morning buyers often complete purchase in one session — optimize checkout for speed.');
  } else if (block === 2) {
    tips.push('Afternoon traffic peak — ideal window for flash sales, limited-time offers, and push notifications.');
    tips.push('Run retargeting ads in the 2 hours before your afternoon peak for best conversion rates.');
  } else if (block === 3) {
    tips.push('Evening shoppers browse more and buy on second visit — use cart abandonment emails with 1-hour delay.');
    tips.push('Social proof (reviews, stock alerts) performs best in the evening window.');
  } else {
    tips.push('Night-time peak is unusual — consider if international traffic is driving this and localise offers.');
  }

  if (dailyTrend === 'rising') {
    tips.push('Weekly traffic is growing — now is the right time to increase ad spend and feature new products.');
  } else if (dailyTrend === 'falling') {
    tips.push('Traffic is declining week-on-week — review recent price changes or product availability issues.');
  }

  return tips;
}

const PERIOD_LABEL = { day: '24-Hour', week: '7-Day', month: '30-Day' };
const PERIOD_VIEWS_LABEL = { day: '24h Page Views', week: '7-Day Page Views', month: '30-Day Page Views' };

export default function ActivityHeatmap({ data, period = 'week' }: Props) {
  const { hourly = [], daily = [], peakHours = [], totalUniqueVisitors = 0 } = data ?? {};

  const maxUsers = Math.max(...hourly.map((h) => h.activeUsers), 1);

  // ── Daily trend direction ──────────────────────────────────
  let dailyTrend: 'rising' | 'falling' | 'stable' = 'stable';
  if (daily.length >= 4) {
    const mid = Math.floor(daily.length / 2);
    const firstHalf = daily.slice(0, mid).reduce((s, d) => s + d.activeUsers, 0) / mid;
    const secondHalf = daily.slice(mid).reduce((s, d) => s + d.activeUsers, 0) / (daily.length - mid);
    if (secondHalf > firstHalf * 1.1) dailyTrend = 'rising';
    else if (secondHalf < firstHalf * 0.9) dailyTrend = 'falling';
  }

  // ── Time-block totals ──────────────────────────────────────
  const blockTotals = [0, 0, 0, 0];
  for (const h of hourly) {
    blockTotals[hourBlock(h.hour)] += h.activeUsers;
  }
  const totalHourly = blockTotals.reduce((a, b) => a + b, 0) || 1;

  // ── Total page views (7-day) ───────────────────────────────
  const totalPageViews = daily.reduce((s, d) => s + d.pageViews, 0);

  // ── Peak hour for marketing tips ──────────────────────────
  const topPeakHour = peakHours.length > 0 ? peakHours[0].hour : 14;
  const marketingTips = getMarketingTips(topPeakHour, dailyTrend);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Summary stats ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, border: '1px solid var(--border)' }}>
        {[
          { value: totalUniqueVisitors.toLocaleString(), label: 'Avg Daily Visitors', tip: 'Average number of active users recorded per day over the tracked period.' },
          { value: totalPageViews.toLocaleString(), label: PERIOD_VIEWS_LABEL[period], tip: `Total page views logged across the selected ${period} window.` },
          { value: peakHours.length > 0 ? fmt12h(peakHours[0].hour) : '—', label: 'Peak Hour', tip: 'The hour of day with the highest average active user count across all recorded days.' },
          {
            value: dailyTrend === 'rising' ? '↑ Rising' : dailyTrend === 'falling' ? '↓ Falling' : '→ Stable',
            label: 'Weekly Trend',
            tip: 'Direction of traffic change comparing the first half vs second half of your 7-day window. Rising = second half outpaces first half by >10%.',
            valueColor: dailyTrend === 'rising' ? 'var(--success)' : dailyTrend === 'falling' ? 'var(--danger)' : 'var(--text)',
          },
        ].map((stat, i, arr) => (
          <div
            key={stat.label}
            className="card"
            style={{
              border: 'none',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              padding: '16px 20px',
            }}
          >
            <div className="stat-value" style={{ color: (stat as { valueColor?: string }).valueColor }}>
              {stat.value}
            </div>
            <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {stat.label}
              <Tooltip text={(stat as { tip: string }).tip} />
            </div>
          </div>
        ))}
      </div>

      {/* ── 7-Day Traffic Trend ──────────────────────────────── */}
      {daily.length > 0 && (
        <section>
          <div className="section-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {PERIOD_LABEL[period]} Traffic Trend
            <Tooltip text={`Daily active users and page views over the selected ${period} window. Solid line = users, dashed = page views.`} />
          </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'DM Mono, monospace',
                color: dailyTrend === 'rising' ? 'var(--success)' : dailyTrend === 'falling' ? 'var(--danger)' : 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}
            >
              {dailyTrend.toUpperCase()}
            </span>
          </div>
          <div className="card" style={{ paddingTop: 20, paddingBottom: 8 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={daily} margin={{ top: 4, right: 16, left: -12, bottom: 4 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip content={<DailyTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  name="active users"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--accent)' }}
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  name="page views"
                  stroke="rgba(245,158,11,0.35)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 20, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              {[
                { color: 'var(--accent)', dash: false, label: 'Active users' },
                { color: 'rgba(245,158,11,0.5)', dash: true, label: 'Page views' },
              ].map((leg) => (
                <div key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text-muted)' }}>
                  <svg width="20" height="8" viewBox="0 0 20 8">
                    {leg.dash
                      ? <line x1="0" y1="4" x2="20" y2="4" stroke={leg.color} strokeWidth="2" strokeDasharray="4 3" />
                      : <line x1="0" y1="4" x2="20" y2="4" stroke={leg.color} strokeWidth="2" />
                    }
                  </svg>
                  {leg.label}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 24-Hour Distribution ────────────────────────────── */}
      <section>
        <div className="section-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            24-Hour Distribution
            <Tooltip text="How traffic is spread across each hour of the day, aggregated across all recorded days. Amber bars highlight your top peak hours." />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
            Active users per hour
          </span>
        </div>
        <div className="card" style={{ paddingTop: 20, paddingBottom: 8 }}>
          <ResponsiveContainer width="100%" height={220}>
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
              <RechartsTooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(245,158,11,0.06)' }} />
              <Bar dataKey="activeUsers" radius={0}>
                {hourly.map((entry) => {
                  const isPeak = peakHours.some((p) => p.hour === entry.hour);
                  const intensity = entry.activeUsers / maxUsers;
                  return (
                    <Cell
                      key={`cell-${entry.hour}`}
                      fill={isPeak ? 'var(--accent)' : `rgba(245,158,11,${0.2 + intensity * 0.5})`}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Time-Block Breakdown ─────────────────────────────── */}
      <section>
        <div className="section-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Traffic by Time Block
            <Tooltip text="Share of total daily traffic falling in each part of the day. Helps identify when your audience is most active at a glance." />
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {BLOCK_LABELS.map((label, bi) => {
            const pct = Math.round((blockTotals[bi] / totalHourly) * 100);
            const isTopBlock = blockTotals[bi] === Math.max(...blockTotals);
            return (
              <div
                key={label}
                className="card"
                style={{
                  padding: '16px 18px',
                  borderLeft: isTopBlock ? '3px solid var(--accent)' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {isTopBlock && (
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>
                    PEAK BLOCK
                  </span>
                )}
                <div style={{ fontSize: 22, fontFamily: 'DM Mono, monospace', color: isTopBlock ? 'var(--accent)' : 'var(--text)' }}>
                  {pct}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{label}</div>
                <div style={{ height: 3, background: 'var(--border)', position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: isTopBlock ? 'var(--accent)' : 'rgba(245,158,11,0.3)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Peak Hour Cards ──────────────────────────────────── */}
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
                  <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '1px 5px', fontFamily: 'DM Mono, monospace' }}>
                    PEAK
                  </div>
                )}
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 400, color: i === 0 ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>
                  {fmt12h(peak.hour)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {peak.activeUsers.toLocaleString()} users
                </div>
                {peak.label && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>{peak.label}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Marketing Timing Recommendations ────────────────── */}
      <section>
        <div className="section-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Marketing Timing Recommendations
            <Tooltip text="Actionable campaign timing advice derived from your store's peak hour pattern and weekly traffic trend. No AI — pure traffic data." />
          </span>
          <span style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', color: 'var(--text-faint)', padding: '3px 8px', border: '1px solid var(--border)', letterSpacing: '0.08em' }}>
            BASED ON YOUR TRAFFIC PATTERN
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {marketingTips.map((tip, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 18px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontWeight: 700, flexShrink: 0, paddingTop: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{tip}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
