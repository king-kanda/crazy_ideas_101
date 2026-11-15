'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api, type OrdersPage } from '@/lib/api';

const PAGE = 50;

const STATUS_FILTERS = ['all', 'processing', 'completed', 'cancelled', 'refunded', 'failed'];

export default function OrdersPage() {
  const { auth, hasStore } = useAuth();
  const token = auth?.token;
  const [page, setPage] = useState<OrdersPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.listOrders(token, PAGE, offset, status === 'all' ? undefined : status)
      .then((r) => { setPage(r); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, offset, status]);

  if (!hasStore) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Connect a store to see orders.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-syne font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Read-only mirror from WooCommerce. {page ? `${page.total} total.` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s} size="sm"
              variant={status === s ? 'default' : 'outline'}
              onClick={() => { setStatus(s); setOffset(0); }}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {error && <p className="p-6 text-sm text-destructive">{error}</p>}
          {!error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Items</Th>
                    <Th className="text-right">Total</Th>
                    <Th>Placed</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><Td colSpan={6} className="text-center text-muted-foreground py-10">Loading…</Td></tr>
                  )}
                  {!loading && page?.items.length === 0 && (
                    <tr><Td colSpan={6} className="text-center text-muted-foreground py-10">No orders match.</Td></tr>
                  )}
                  {page?.items.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <Td className="font-mono text-xs">#{o.wc_order_id}</Td>
                      <Td>
                        <div className="font-medium">{o.customer_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{o.customer_email || ''}</div>
                      </Td>
                      <Td><OrderStatusBadge status={o.status} /></Td>
                      <Td className="text-right font-mono">{o.items.length}</Td>
                      <Td className="text-right font-mono">
                        {o.total != null ? `${o.currency || ''} ${o.total.toFixed(2)}`.trim() : '—'}
                      </Td>
                      <Td className="text-muted-foreground text-xs">
                        {o.order_created_at ? new Date(o.order_created_at).toLocaleString() : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {page && page.total > PAGE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE, page.total)} of {page.total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
            <Button size="sm" variant="outline" disabled={offset + PAGE >= page.total}
              onClick={() => setOffset(offset + PAGE)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left font-medium text-muted-foreground ${className}`}>{children}</th>;
}

function Td({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-4 py-3 ${className}`}>{children}</td>;
}

function OrderStatusBadge({ status }: { status: string }) {
  const ok = ['completed', 'processing'].includes(status);
  const bad = ['failed', 'cancelled', 'refunded'].includes(status);
  if (ok) return <Badge className="bg-[var(--lime-soft)] text-[var(--ink)] border-0">{status}</Badge>;
  if (bad) return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
