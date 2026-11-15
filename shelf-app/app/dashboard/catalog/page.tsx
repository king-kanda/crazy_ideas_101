'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api, type ProductsPage } from '@/lib/api';

const PAGE = 50;

export default function CatalogPage() {
  const { auth, hasStore } = useAuth();
  const token = auth?.token;
  const [page, setPage] = useState<ProductsPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.listProducts(token, PAGE, offset)
      .then((r) => { setPage(r); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, offset]);

  if (!hasStore) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Connect a store to see your catalog. Head to Integrations → WooCommerce.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-syne font-semibold">Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Products synced from WooCommerce. Read-only.
            {page ? ` ${page.total} total.` : ''}
          </p>
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
                    <Th>Product</Th>
                    <Th>Category</Th>
                    <Th className="text-right">Price</Th>
                    <Th>Stock</Th>
                    <Th className="text-right">Qty</Th>
                    <Th>Synced</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><Td colSpan={6} className="text-center text-muted-foreground py-10">Loading…</Td></tr>
                  )}
                  {!loading && page?.items.length === 0 && (
                    <tr><Td colSpan={6} className="text-center text-muted-foreground py-10">No products yet — trigger a sync from Integrations → WooCommerce.</Td></tr>
                  )}
                  {page?.items.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <Td className="font-medium">{p.name}</Td>
                      <Td className="text-muted-foreground">{p.category || '—'}</Td>
                      <Td className="text-right font-mono">{p.price != null ? p.price.toFixed(2) : '—'}</Td>
                      <Td><StockBadge status={p.stock_status} /></Td>
                      <Td className="text-right font-mono">{p.stock_quantity ?? '—'}</Td>
                      <Td className="text-muted-foreground text-xs">{new Date(p.synced_at).toLocaleString()}</Td>
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

function StockBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  if (status === 'instock') return <Badge className="bg-[var(--lime-soft)] text-[var(--ink)] border-0">In stock</Badge>;
  if (status === 'outofstock') return <Badge variant="destructive">Out</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
