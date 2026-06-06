'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import type { DemandResponse } from '@/lib/api';
import GapAlert from './GapAlert';
import Tooltip from './Tooltip';

interface Props {
  data: DemandResponse;
}

type StockStatus = 'STOCKED' | 'GAP' | 'OPPORTUNITY';

const STATUS_COLOR: Record<StockStatus, string> = {
  STOCKED:     '#22c55e',
  GAP:         '#ef4444',
  OPPORTUNITY: '#f59e0b',
};

const STATUS_STYLE: Record<StockStatus, { color: string; bg: string; border: string }> = {
  STOCKED:     { color: 'var(--success)',  bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)' },
  GAP:         { color: 'var(--danger)',   bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)' },
  OPPORTUNITY: { color: 'var(--accent)',   bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)' },
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 12, color: 'var(--text)', minWidth: 160 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)' }}>{p.name}</span>
          <span style={{ color: p.color, fontFamily: 'DM Mono, monospace' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DemandGaps({ data }: Props) {
  const { topSearches = [], trendingKeywords = [], demandGaps = [], productCategories = [] } = data ?? {};

  // Trend keywords come from niche + product categories — they ARE in your catalog.
  // Status reflects the buyer search signal, not catalog membership:
  //   STOCKED:     buyers are actively searching AND finding results → good coverage
  //   GAP:         buyers search for this category but get zero results → listing/stock issue
  //   OPPORTUNITY: trending on Google, no buyer searches yet → needs promotion/SEO
  const categorySet = new Set(productCategories.map((c) => c.toLowerCase()));

  const trendStockRows = trendingKeywords.map((kw) => {
    // Match: any search query that shares a meaningful word with this keyword
    const kwWords = kw.keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const match = topSearches.find((s) => {
      const q = s.query.toLowerCase();
      return q.includes(kw.keyword.toLowerCase()) || kwWords.some((w) => q.includes(w));
    });

    let status: StockStatus;
    if (!match) {
      status = 'OPPORTUNITY';
    } else if (match.zeroResults) {
      status = 'GAP';
    } else {
      status = 'STOCKED';
    }
    return { keyword: kw.keyword, score: kw.score, delta: kw.delta, status, searchCount: match?.count ?? 0 };
  });

  const featuredRecs = trendStockRows.filter((r) => r.status === 'STOCKED').slice(0, 4);
  const gapCount   = trendStockRows.filter((r) => r.status === 'GAP').length;
  const oppCount   = trendStockRows.filter((r) => r.status === 'OPPORTUNITY').length;

  const coveragePct = topSearches.length > 0
    ? Math.round((topSearches.filter((s) => !s.zeroResults).length / topSearches.length) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── 1. Search Intelligence ──────────────────────────────── */}
      <section>
        <div className="section-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Search Intelligence
            <Tooltip text="Aggregated queries from your store's search bar, showing what buyers are actively looking for and whether your catalog matched them." />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              {topSearches.length} queries
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  height: 6,
                  width: 72,
                  background: 'var(--border)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${coveragePct}%`,
                    background: coveragePct >= 70 ? 'var(--success)' : coveragePct >= 40 ? 'var(--accent)' : 'var(--danger)',
                    transition: 'width 0.4s',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                {coveragePct}% covered
              </span>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Query</th>
                <th style={{ textAlign: 'right' }}>Searches</th>
                <th style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Catalog Match
                    <Tooltip text="Whether your store returned at least one product result for this search query. 'No Results' means buyers searched but found nothing." />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {topSearches.map((row, i) => (
                <tr key={row.query}>
                  <td style={{ color: 'var(--text-muted)', width: 36, fontFamily: 'DM Mono, monospace' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{row.query}</td>
                  <td style={{ textAlign: 'right', color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>
                    {row.count.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.zeroResults ? (
                      <span className="badge badge-danger">No Results</span>
                    ) : (
                      <span className="badge badge-muted">Covered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2. Google Trends vs Your Stock ─────────────────────── */}
      {trendingKeywords.length > 0 && (
        <section>
          <div className="section-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Google Trends vs Your Stock
            <Tooltip text="Keywords come from your niche + product categories — so they are in your catalog. STOCKED = buyers find them when they search. GAP = buyers search but get zero results (stock/listing issue). OPPORTUNITY = trending but buyers haven't searched your store yet — needs promotion." />
          </span>
            <div style={{ display: 'flex', gap: 10 }}>
              {gapCount > 0 && (
                <span style={{ fontSize: 10, color: 'var(--danger)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>
                  {gapCount} GAP{gapCount > 1 ? 'S' : ''}
                </span>
              )}
              {oppCount > 0 && (
                <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>
                  {oppCount} OPPORTUNITY
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Trends vs Store Activity chart */}
            {(() => {
              const maxSearches = Math.max(...trendStockRows.map((r) => r.searchCount), 1);
              const chartData = trendStockRows.map((r) => ({
                keyword: r.keyword,
                'Google Trends': r.score,
                'Store Searches': Math.round((r.searchCount / maxSearches) * 100),
                status: r.status,
              }));
              return (
                <div className="card" style={{ paddingTop: 20, paddingBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace', marginBottom: 12, paddingLeft: 4 }}>
                    GOOGLE TRENDS INTEREST (0–100) vs STORE SEARCH ACTIVITY (normalised)
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }} barCategoryGap="25%" barGap={3}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="keyword"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={false}
                      />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Legend
                        wrapperStyle={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)', paddingTop: 8 }}
                        iconSize={8}
                        iconType="square"
                      />
                      <Bar dataKey="Google Trends" radius={0}>
                        {chartData.map((entry) => (
                          <Cell key={entry.keyword} fill={STATUS_COLOR[entry.status as StockStatus]} fillOpacity={0.85} />
                        ))}
                      </Bar>
                      <Bar dataKey="Store Searches" fill="rgba(148,163,184,0.35)" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Status colour legend */}
                  <div style={{ display: 'flex', gap: 16, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    {(['STOCKED', 'GAP', 'OPPORTUNITY'] as StockStatus[]).map((s) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ width: 8, height: 8, background: STATUS_COLOR[s], display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: STATUS_COLOR[s], fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{s}</span>
                      </div>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                      Grey bar = store search volume (scaled to 0–100)
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Cross-reference table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Trending Keyword</th>
                    <th style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Interest <Tooltip text="Google Trends score (0–100) for this keyword over the past 7 days in your store's region." />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        WoW <Tooltip text="Week-over-week change in Google Trends interest." />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right' }}>Store Searches</th>
                    <th style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Status <Tooltip text="STOCKED: buyers search & find results. GAP: buyers search but get zero results — listing or stock issue. OPPORTUNITY: trending but no buyer searches yet — promote it." />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trendStockRows.map((row) => {
                    const st = STATUS_STYLE[row.status];
                    return (
                      <tr key={row.keyword}>
                        <td style={{ fontWeight: 500 }}>{row.keyword}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{row.score}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: row.delta >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 11 }}>
                          {row.delta >= 0 ? '+' : ''}{row.delta}%
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>
                          {row.searchCount > 0 ? row.searchCount.toLocaleString() : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              padding: '2px 7px',
                              color: st.color,
                              background: st.bg,
                              border: `1px solid ${st.border}`,
                              fontFamily: 'DM Mono, monospace',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {(['STOCKED', 'GAP', 'OPPORTUNITY'] as StockStatus[]).map((s) => {
                  const st = STATUS_STYLE[s];
                  const desc = s === 'STOCKED' ? 'Trending + in your catalog' : s === 'GAP' ? 'Trending + buyers searched + no results' : 'Trending on Google, not yet searched here';
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span style={{ width: 6, height: 6, background: st.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: st.color, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{s}</span>
                      <span>— {desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. AI Gap Analysis ──────────────────────────────────── */}
      <section>
        <div className="section-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            AI Gap Analysis
            <Tooltip text="Signals generated by llama-3.3-70b-versatile via Groq. The model analyses your zero-result searches, trending keywords, and product catalog to surface unmet demand." />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 9,
                color: 'var(--text-faint)',
                fontFamily: 'DM Mono, monospace',
                letterSpacing: '0.08em',
                padding: '3px 8px',
                border: '1px solid var(--border)',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
              llama-3.3-70b-versatile · Groq
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              {demandGaps.filter((g) => g.severity === 'high').length} high priority
            </span>
          </div>
        </div>

        {demandGaps.length === 0 ? (
          <div className="card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>No demand gaps detected in this period.</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Run analysis to generate AI-powered gap signals.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demandGaps.map((gap, i) => (
              <GapAlert
                key={gap.id}
                signal={gap.signal}
                severity={gap.severity}
                category={gap.category}
                action={gap.action}
                index={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Featured Product Recommendations ─────────────────── */}
      {featuredRecs.length > 0 && (
        <section>
          <div className="section-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Featured Product Recommendations
            <Tooltip text="Products already in your catalog that are currently trending on Google. High buyer intent confirmed — these are prime candidates for homepage featuring or promotions." />
          </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              Trending + stocked — surface these first
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {featuredRecs.map((rec, i) => (
              <div
                key={rec.keyword}
                className="card"
                style={{
                  padding: '18px 20px',
                  borderLeft: '3px solid var(--accent)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: 'var(--accent)',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    FEATURE #{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      color: 'var(--success)',
                      fontFamily: 'DM Mono, monospace',
                      padding: '2px 6px',
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}
                  >
                    IN STOCK
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 16,
                    fontWeight: 400,
                    color: 'var(--text)',
                    textTransform: 'capitalize',
                  }}
                >
                  {rec.keyword}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{rec.score}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>TREND SCORE</div>
                  </div>
                  {rec.searchCount > 0 && (
                    <div>
                      <div style={{ fontSize: 18, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                        {rec.searchCount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>SEARCHES</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  High buyer intent confirmed — add to featured products or run a promotion.
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
