'use client';

import { useEffect, useState } from 'react';
import { getAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { StoreResponse } from '@/lib/api';
import CartFunnel from '@/components/CartFunnel';
import Tooltip from '@/components/Tooltip';

// ── Mock data ──────────────────────────────────────────────────

const MOCK_DATA: StoreResponse = {
  funnel: [
    { label: 'Page Views', count: 12480 },
    { label: 'Add to Cart', count: 3142 },
    { label: 'Checkout Start', count: 1834 },
    { label: 'Purchase', count: 748 },
  ],
  highAbandonProducts: [
    { id: '1', name: 'Logitech MX Keys Mini', sku: 'LGT-MXKM', abandonRate: 74.2, addToCartCount: 312 },
    { id: '2', name: 'Sony WH-1000XM5', sku: 'SNY-XM5', abandonRate: 68.1, addToCartCount: 287 },
    { id: '3', name: 'Anker 10-Port USB Hub', sku: 'ANK-HB10', abandonRate: 65.9, addToCartCount: 198 },
    { id: '4', name: 'VIVO Dual Monitor Stand', sku: 'VVO-DMS2', abandonRate: 61.4, addToCartCount: 145 },
    { id: '5', name: 'Elgato Key Light Air', sku: 'ELG-KLA', abandonRate: 59.0, addToCartCount: 134 },
  ],
  topSellers: [
    { id: '1', name: 'Apple AirPods Pro (2nd Gen)', sku: 'APL-APP2', unitsSold: 1204, revenue: 298_796 },
    { id: '2', name: 'Logitech C920 Webcam', sku: 'LGT-C920', unitsSold: 892, revenue: 62_440 },
    { id: '3', name: 'SanDisk 1TB Portable SSD', sku: 'SDK-1TSSD', unitsSold: 763, revenue: 76_300 },
    { id: '4', name: 'Razer BlackWidow V3 TKL', sku: 'RZR-BWV3T', unitsSold: 541, revenue: 75_740 },
    { id: '5', name: 'Corsair K70 RGB Pro', sku: 'CRS-K70P', unitsSold: 487, revenue: 68_180 },
  ],
  generatedAt: new Date().toISOString(),
};

// ── Page ───────────────────────────────────────────────────────

export default function StorePage() {
  const [data, setData] = useState<StoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const auth = getAuth();
      if (!auth) { setError('Not authenticated.'); setLoading(false); return; }
      try {
        const res = await api.store(auth.storeId, auth.apiKey);
        setData(res);
      } catch {
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
          Loading Store Data...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {error && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          ⚠ {error}
        </div>
      )}

      {data && (
        <>
          {/* Funnel */}
          <CartFunnel stages={data.funnel} />

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, border: '1px solid var(--border)' }}>
            {[
              { label: 'Page Views',  value: data.funnel[0]?.count.toLocaleString() ?? '—', tip: 'Total product page views recorded by the plugin.' },
              { label: 'Add to Cart', value: data.funnel[1]?.count.toLocaleString() ?? '—', tip: 'Number of add-to-cart events captured — buyers who showed strong purchase intent.' },
              { label: 'Checkouts',   value: data.funnel[2]?.count.toLocaleString() ?? '—', tip: 'Buyers who proceeded to checkout after adding items to cart.' },
              { label: 'Purchases',   value: data.funnel[3]?.count.toLocaleString() ?? '—', tip: 'Completed purchase events recorded. This is your conversion end-point.' },
            ].map((stat, i, arr) => (
              <div
                key={stat.label}
                className="card"
                style={{ border: 'none', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', padding: '16px 20px' }}
              >
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {stat.label}
                  <Tooltip text={stat.tip} />
                </div>
              </div>
            ))}
          </div>

          {/* High abandon products */}
          <section>
            <div className="section-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                High Abandonment Products
                <Tooltip text="Products frequently added to cart but not purchased. A high abandon rate suggests price sensitivity, shipping costs, or missing trust signals." />
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                {data.highAbandonProducts.length} products
              </span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Adds to Cart</th>
                    <th style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Abandon Rate
                        <Tooltip text="Percentage of add-to-cart events for this product that did not result in a purchase." />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.highAbandonProducts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.sku}</td>
                      <td style={{ textAlign: 'right' }}>{p.addToCartCount.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            color:
                              p.abandonRate > 70
                                ? 'var(--danger)'
                                : p.abandonRate > 60
                                ? 'var(--warning)'
                                : 'var(--text)',
                            fontWeight: 600,
                          }}
                        >
                          {p.abandonRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top sellers */}
          <section>
            <div className="section-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Top Sellers
                <Tooltip text="Products ranked by completed purchases. Use this to identify what's working and inform restocking decisions." />
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                {data.topSellers.length} products
              </span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topSellers.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.sku}</td>
                      <td style={{ textAlign: 'right' }}>{p.unitsSold.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 500 }}>
                        ${p.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
