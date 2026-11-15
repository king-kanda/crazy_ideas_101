'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api, type WooCommerceStatus } from '@/lib/api';

const RESYNC_COOLDOWN_MS = 60_000;

export default function WooCommerceIntegrationPage() {
  const { auth } = useAuth();
  const token = auth?.token;
  const [data, setData] = useState<WooCommerceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastClickRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.wcStatus(token);
      setData(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const triggerResync = async () => {
    if (!token) return;
    const now = Date.now();
    if (now - lastClickRef.current < 2_000) return; // client-side debounce
    lastClickRef.current = now;
    setResyncing(true);
    try {
      await api.wcResync(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resync failed');
    } finally {
      setResyncing(false);
    }
  };

  const resyncCoolingDown = data?.resync_requested_at
    ? Date.now() - new Date(data.resync_requested_at).getTime() < RESYNC_COOLDOWN_MS
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-syne font-semibold">WooCommerce</h1>
        <p className="text-sm text-muted-foreground">
          Connection status and sync health for your WooCommerce store.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status</CardTitle>
            {loading ? (
              <Badge variant="outline">…</Badge>
            ) : data?.connected ? (
              <Badge className="bg-[var(--lime-soft)] text-[var(--ink)] border-0">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <CardDescription>
            The plugin pushes products, orders, stock and activity using your store&apos;s API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Store URL" value={data?.store_url || '—'} />
            <Stat label="Plugin host" value={data?.plugin_site_url || '—'} />
            <Stat label="Products" value={data ? String(data.product_count) : '—'} />
            <Stat label="Orders" value={data ? String(data.order_count) : '—'} />
            <Stat
              label="Last sync"
              value={data?.last_sync_at ? new Date(data.last_sync_at).toLocaleString() : 'Never'}
            />
            <Stat
              label="Resync requested"
              value={data?.resync_requested_at ? new Date(data.resync_requested_at).toLocaleString() : '—'}
            />
          </dl>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={triggerResync}
              disabled={!data?.connected || resyncing || resyncCoolingDown}
            >
              {resyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {resyncCoolingDown ? 'Resync pending — plugin will pick it up' : 'Re-sync now'}
            </Button>
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sync jobs</CardTitle>
          <CardDescription>Last 5 sync runs reported by the plugin.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kind</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Records</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Started</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Finished</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_jobs ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No sync jobs yet.</td></tr>
                )}
                {data?.recent_jobs.map((j, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{j.kind}</td>
                    <td className="px-4 py-3">
                      {j.status === 'completed' && <Badge className="bg-[var(--lime-soft)] text-[var(--ink)] border-0">done</Badge>}
                      {j.status === 'failed' && <Badge variant="destructive">failed</Badge>}
                      {j.status === 'running' && <Badge variant="outline">running</Badge>}
                      {j.status === 'pending' && <Badge variant="outline">pending</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{j.records_processed}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {j.started_at ? new Date(j.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {j.finished_at ? new Date(j.finished_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-dm-mono text-sm truncate">{value}</dd>
    </div>
  );
}
