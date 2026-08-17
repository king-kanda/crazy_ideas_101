'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import { isAuthenticated, getAuth } from '@/lib/auth';
import {
  api,
  type DemandResponse,
  type StoreResponse,
  type ActivityResponse,
} from '@/lib/api';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ArrowRight } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────

const fmtInt = (n: number) => n.toLocaleString('en-KE');
const fmtCurrency = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

function KpiCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div
            className="text-3xl font-normal leading-none"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            {value}
          </div>
        )}
        {hint && (
          <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [demand, setDemand] = useState<DemandResponse | null>(null);
  const [store, setStore] = useState<StoreResponse | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    const auth = getAuth();
    if (!auth) return;
    if (auth.storeName) setStoreName(auth.storeName);

    Promise.allSettled([
      api.demand(auth.storeId, auth.apiKey),
      api.store(auth.storeId, auth.apiKey),
      api.activity(auth.storeId, auth.apiKey, 'week'),
    ]).then(([d, s, a]) => {
      if (d.status === 'fulfilled') setDemand(d.value);
      if (s.status === 'fulfilled') setStore(s.value);
      if (a.status === 'fulfilled') setActivity(a.value);
      setLoading(false);
    });
  }, [router]);

  const funnel = store?.funnel ?? [];
  const addToCart = funnel.find((f) => /add/i.test(f.label))?.count ?? 0;
  const abandoned = funnel.find((f) => /aband/i.test(f.label))?.count ?? 0;
  const purchased = funnel.find((f) => /purch/i.test(f.label))?.count ?? 0;
  const revenue = (store?.topSellers ?? []).reduce((sum, s) => sum + s.revenue, 0);
  const cartRecoveryRate =
    abandoned + purchased > 0 ? (purchased / (abandoned + purchased)) * 100 : 0;
  const activeBuyers = activity?.totalUniqueVisitors ?? 0;
  const topZeroSearch = demand?.topSearches.find((s) => s.zeroResults)?.query;
  const gapCount = demand?.demandGaps.length ?? 0;
  const trendCount = demand?.trendingKeywords.length ?? 0;
  const zeroResultCount =
    demand?.topSearches.filter((s) => s.zeroResults).length ?? 0;

  // ── Chart configs ─────────────────────────────────────────────
  const buyersConfig = {
    activeUsers: { label: 'Buyers', color: 'var(--lime)' },
  } satisfies ChartConfig;

  const funnelConfig = {
    count: { label: 'Sessions', color: 'var(--lime)' },
  } satisfies ChartConfig;

  const funnelData = funnel.map((f) => ({ stage: f.label, count: f.count }));
  const buyersData = (activity?.daily ?? []).map((d) => ({
    date: d.date.slice(5),
    activeUsers: d.activeUsers,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {storeName ? `${storeName} — Overview` : 'Overview'}
          </h1>
          <p className="mt-1 max-w-[640px] text-xs text-muted-foreground">
            Everything Palda is measuring across your storefront, messaging, and
            demand — in one view. Panels with no live source show a clear
            connection status.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Currency</span>
            <Badge variant="outline" className="rounded-sm">
              KES
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span>Timezone</span>
            <Badge variant="outline" className="rounded-sm">
              EAT
            </Badge>
          </div>
        </div>
      </div>

      {/* ── KPI grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Median first-reply"
          value="—"
          hint="Awaiting WhatsApp connect (Phase 2)"
        />
        <KpiCard
          label="Agent-resolved"
          value="—"
          hint="Chat agent not live yet"
        />
        <KpiCard
          label="Cart recovery"
          loading={loading}
          value={`${cartRecoveryRate.toFixed(1)}%`}
          hint={`${fmtInt(purchased)} closed of ${fmtInt(abandoned + purchased)} carts`}
        />
        <KpiCard
          label="Active buyers / wk"
          loading={loading}
          value={fmtInt(activeBuyers)}
          hint="Unique visitors on your storefront"
        />
      </div>

      {/* ── Charts row: Buyers over time + Cart funnel ────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Buyers on storefront</CardTitle>
            <CardDescription>Last 7 days · unique daily visitors</CardDescription>
            <CardAction>
              <Link
                href="/dashboard/activity"
                className="text-[11px] font-semibold uppercase tracking-wider text-foreground hover:underline"
              >
                Activity →
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : buyersData.length === 0 ? (
              <EmptyState label="No activity in the last 7 days." />
            ) : (
              <ChartContainer config={buyersConfig} className="h-[220px] w-full">
                <AreaChart data={buyersData} margin={{ left: 0, right: 8 }}>
                  <defs>
                    <linearGradient id="buyersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-activeUsers)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-activeUsers)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={28} tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    dataKey="activeUsers"
                    type="monotone"
                    stroke="var(--color-activeUsers)"
                    fill="url(#buyersFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cart funnel</CardTitle>
            <CardDescription>Add → abandon → purchase</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : funnelData.length === 0 ? (
              <EmptyState label="No cart events yet." />
            ) : (
              <ChartContainer config={funnelConfig} className="h-[220px] w-full">
                <BarChart data={funnelData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="stage" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={28} tickLine={false} axisLine={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Storefront + Messaging ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Storefront</CardTitle>
            <CardDescription>Live catalog and orders from WooCommerce</CardDescription>
            <CardAction>
              <Badge className="rounded-sm bg-lime-soft text-ink hover:bg-lime-soft">
                WooCommerce
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Stat label="Orders" loading={loading} value={fmtInt(purchased)} />
            <Stat label="Revenue" loading={loading} value={fmtCurrency(revenue)} />
            <Stat label="Add-to-cart" loading={loading} value={fmtInt(addToCart)} />
          </CardContent>
          <CardFooter className="border-t pt-4">
            <Link
              href="/dashboard/store"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:underline"
            >
              Store health <ArrowRight className="size-3" />
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messaging &amp; channels</CardTitle>
            <CardDescription>
              Meta Embedded Signup lands in Phase 2. First-reply time and agent-resolved rate populate
              once connected.
            </CardDescription>
            <CardAction>
              <Badge variant="outline" className="rounded-sm">
                Not connected
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { label: 'WhatsApp Business', sub: 'Cloud API via Meta ES' },
              { label: 'Instagram DMs', sub: 'IG Messaging' },
              { label: 'Facebook Messenger', sub: 'Page inbox' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-sm border px-3 py-2"
              >
                <div>
                  <div className="text-[13px] font-semibold">{row.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {row.sub}
                  </div>
                </div>
                <Badge variant="outline" className="rounded-sm">
                  Connect
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Demand + Ads attribution ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demand intelligence</CardTitle>
            <CardDescription>
              Zero-result searches, trending keywords, and gap signals from Groq +
              Google Trends.
            </CardDescription>
            <CardAction>
              <Link
                href="/dashboard/demand"
                className="text-[11px] font-semibold uppercase tracking-wider hover:underline"
              >
                Open →
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Stat label="Gap signals" loading={loading} value={fmtInt(gapCount)} />
            <Stat label="Trending kws" loading={loading} value={fmtInt(trendCount)} />
            <Stat label="Zero-result" loading={loading} value={fmtInt(zeroResultCount)} />
          </CardContent>
          {topZeroSearch && (
            <CardFooter className="border-t pt-4 text-xs">
              <span className="text-muted-foreground">Top unmet demand:&nbsp;</span>
              <span className="font-semibold">&quot;{topZeroSearch}&quot;</span>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ads → sale attribution</CardTitle>
            <CardDescription>
              Meta Marketing API is deferred (PRD §7). Spend → orders will link via
              <code className="mx-1 text-foreground">ctwa_clid</code>
              once WhatsApp is connected.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary" className="rounded-sm">
                Deferred
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 opacity-60">
            <Stat label="CTWA clicks" value="—" />
            <Stat label="Attributed orders" value="—" />
            <Stat label="Blended ROAS" value="—" />
          </CardContent>
        </Card>
      </div>

      {/* ── KB + Cart recovery + Integrations ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge base</CardTitle>
            <CardDescription>
              Grounded product / policy / FAQ retrieval for the chat agent.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary" className="rounded-sm">
                Phase 4
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Entries indexed" value="—" />
            <Stat label="Last reindex" value="—" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cart recovery</CardTitle>
            <CardDescription>
              Automation fires once checkout write-back exists. Configure rules early
              in Settings.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary" className="rounded-sm">
                Config only
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Abandoned" loading={loading} value={fmtInt(abandoned)} />
            <Stat label="Recovered" loading={loading} value={fmtInt(purchased)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations health</CardTitle>
            <CardDescription>
              Single source of truth for what&apos;s connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-[12px]">
            <IntegrationRow name="WooCommerce" tone="connected" label="OK" />
            <IntegrationRow name="WhatsApp Cloud" tone="not_connected" label="Not connected" />
            <IntegrationRow name="Instagram" tone="not_connected" label="Not connected" />
            <IntegrationRow name="Facebook" tone="not_connected" label="Not connected" />
            <IntegrationRow name="Qdrant (KB)" tone="pending" label="Phase 4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-16" />
      ) : (
        <div
          className="text-xl leading-none"
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function IntegrationRow({
  name,
  label,
  tone,
}: {
  name: string;
  label: string;
  tone: 'connected' | 'not_connected' | 'pending';
}) {
  const variant =
    tone === 'connected' ? 'default' : tone === 'pending' ? 'secondary' : 'outline';
  const cls =
    tone === 'connected'
      ? 'rounded-sm bg-lime-soft text-ink hover:bg-lime-soft'
      : 'rounded-sm';
  return (
    <div className="flex items-center justify-between">
      <span>{name}</span>
      <Badge variant={variant} className={cls}>
        {label}
      </Badge>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
