const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://shelf-7a6211a30e15.herokuapp.com';

// ── Request types ──────────────────────────────────────────────

export interface SignupData {
  email: string;
  password: string;
  store_name: string;
  store_url: string;
  niche?: string;
  location_country?: string;
  location_city?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// ── Response types ─────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  apiKey: string;
  storeId: string;
}

interface RawAuthResponse {
  token: string;
  api_key: string;
  store_id: string;
}

export interface VerifyResponse {
  verified: boolean;
  storeId: string;
  storeName: string;
  lastSync?: string;
}

export interface StoreProfile {
  storeName: string;
  storeUrl: string;
  niche: string | null;
  locationCountry: string | null;
  locationCity: string | null;
  pluginSiteUrl: string | null;
}

export interface UpdateProfileData {
  storeName?: string;
  storeUrl?: string;
  niche?: string;
  locationCountry?: string;
  locationCity?: string;
}

export interface SearchQuery {
  query: string;
  count: number;
  zeroResults: boolean;
}

export interface TrendingKeyword {
  keyword: string;
  score: number;
  delta: number;
}

export interface DemandGap {
  id: string;
  signal: string;
  severity: 'high' | 'medium' | 'low';
  category?: string;
  action?: string;
}

export interface DemandResponse {
  topSearches: SearchQuery[];
  trendingKeywords: TrendingKeyword[];
  demandGaps: DemandGap[];
  productCategories: string[];
  generatedAt: string;
}

export interface FunnelStage {
  label: string;
  count: number;
}

export interface AbandonedProduct {
  id: string;
  name: string;
  sku: string;
  abandonRate: number;
  addToCartCount: number;
}

export interface TopSeller {
  id: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
}

export interface StoreResponse {
  funnel: FunnelStage[];
  highAbandonProducts: AbandonedProduct[];
  topSellers: TopSeller[];
  generatedAt: string;
}

export interface HourlyActivity {
  hour: number;
  activeUsers: number;
}

export interface PeakHour {
  hour: number;
  activeUsers: number;
  label: string;
}

export interface DailyActivity {
  date: string;
  activeUsers: number;
  pageViews: number;
}

export interface ActivityResponse {
  hourly: HourlyActivity[];
  daily: DailyActivity[];
  peakHours: PeakHour[];
  totalUniqueVisitors: number;
  generatedAt: string;
}

// ── Fetch wrapper ──────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { apiKey?: string; authToken?: string }
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.apiKey) headers['X-Shelf-API-Key'] = options.apiKey;
  if (options?.authToken) headers['Authorization'] = `Bearer ${options.authToken}`;

  const { apiKey: _apiKey, authToken: _authToken, ...restOptions } = options ?? {};
  const res = await fetch(`${API_URL}${path}`, { ...restOptions, headers });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── API surface ────────────────────────────────────────────────

export const api = {
  signup: async (data: SignupData): Promise<AuthResponse> => {
    const raw = await apiFetch<RawAuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { token: raw.token, apiKey: raw.api_key, storeId: raw.store_id };
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const raw = await apiFetch<RawAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { token: raw.token, apiKey: raw.api_key, storeId: raw.store_id };
  },

  regenerateKey: async (token: string): Promise<{ apiKey: string }> => {
    const raw = await apiFetch<{ api_key: string }>('/auth/regenerate-key', {
      method: 'POST',
      authToken: token,
    });
    return { apiKey: raw.api_key };
  },

  verify: async (apiKey: string): Promise<VerifyResponse> => {
    const raw = await apiFetch<{ verified: boolean; store_name: string; store_id: string }>(
      '/auth/verify',
      { apiKey },
    );
    return { verified: raw.verified, storeName: raw.store_name, storeId: raw.store_id };
  },

  demand: async (storeId: string, apiKey: string): Promise<DemandResponse> => {
    const raw = await apiFetch<Record<string, unknown>>(`/insights/${storeId}/demand`, { apiKey });
    const searches = (raw.top_searches ?? raw.topSearches ?? []) as Array<Record<string, unknown>>;
    const trends   = (raw.trend_keywords ?? raw.trendingKeywords ?? []) as Array<Record<string, unknown>>;
    const gaps     = (raw.gaps ?? raw.demandGaps ?? []) as Array<Record<string, unknown>>;
    return {
      topSearches: searches.map((s) => ({
        query:       s.query as string,
        count:       s.count as number,
        zeroResults: (s.zero_results ?? s.zeroResults) as boolean,
      })),
      trendingKeywords: trends.map((t) => ({
        keyword: t.keyword as string,
        score:   (t.interest ?? t.score ?? 0) as number,
        delta:   (t.delta ?? 0) as number,
      })),
      demandGaps: gaps.map((g, i) => ({
        id:       (g.id ?? String(i)) as string,
        signal:   g.signal as string,
        severity: g.severity as 'high' | 'medium' | 'low',
        category: g.category as string | undefined,
        action:   g.action as string | undefined,
      })),
      productCategories: (raw.product_categories ?? []) as string[],
      generatedAt: (raw.generatedAt ?? new Date().toISOString()) as string,
    };
  },

  store: async (storeId: string, apiKey: string): Promise<StoreResponse> => {
    const raw = await apiFetch<Record<string, unknown>>(`/insights/${storeId}/store`, { apiKey });

    // cart_funnel is an object {add_to_cart, abandoned, purchased} — reshape to array
    const cf = (raw.cart_funnel ?? raw.funnel ?? {}) as Record<string, unknown>;
    const funnel: FunnelStage[] = Array.isArray(raw.funnel)
      ? (raw.funnel as FunnelStage[])
      : [
          { label: 'Add to Cart', count: (cf.add_to_cart ?? 0) as number },
          { label: 'Abandoned',   count: (cf.abandoned ?? 0) as number },
          { label: 'Purchased',   count: (cf.purchased ?? 0) as number },
        ];

    const abandons = (raw.high_abandon_products ?? raw.highAbandonProducts ?? []) as Array<Record<string, unknown>>;
    const sellers  = (raw.top_sellers ?? raw.topSellers ?? []) as Array<Record<string, unknown>>;

    return {
      funnel,
      highAbandonProducts: abandons.map((p, i) => ({
        id:             (p.id ?? String(i)) as string,
        name:           (p.product_name ?? p.name) as string,
        sku:            (p.sku ?? '—') as string,
        abandonRate:    (p.abandon_rate ?? p.abandonRate ?? 0) as number,
        addToCartCount: (p.views ?? p.addToCartCount ?? 0) as number,
      })),
      topSellers: sellers.map((p, i) => ({
        id:        (p.id ?? String(i)) as string,
        name:      (p.product_name ?? p.name) as string,
        sku:       (p.sku ?? '—') as string,
        unitsSold: (p.purchase_count ?? p.unitsSold ?? 0) as number,
        revenue:   (p.revenue ?? 0) as number,
      })),
      generatedAt: (raw.generatedAt ?? new Date().toISOString()) as string,
    };
  },

  labs: {
    groq: async (token: string) =>
      apiFetch<{ ok: boolean; model?: string; response?: string; response_time_ms?: number; error?: string }>(
        '/labs/groq', { authToken: token }
      ),
    celery: async (token: string) =>
      apiFetch<{ ok: boolean; workers?: string[]; count?: number; error?: string }>(
        '/labs/celery', { authToken: token }
      ),
    trends: async (token: string) =>
      apiFetch<{ ok: boolean; keyword?: string; geo?: string; avg_interest?: number; response_time_ms?: number; error?: string }>(
        '/labs/trends', { authToken: token }
      ),
    demoStatus: async (token: string) =>
      apiFetch<{
        loaded: boolean;
        counts: { products?: number; cart_events?: number; search_events?: number; activity_logs?: number };
      }>('/labs/demo/status', { authToken: token }),
    demoLoad: async (token: string) =>
      apiFetch<{
        loaded: boolean;
        products_created: number;
        used_real_products: boolean;
        cart_events: number;
        search_events: number;
        activity_logs: number;
      }>('/labs/demo/load', { method: 'POST', authToken: token }),
    demoDelete: async (token: string) =>
      apiFetch<{ deleted: boolean }>('/labs/demo', { method: 'DELETE', authToken: token }),
  },

  refreshDemand: async (storeId: string, token: string): Promise<DemandResponse> => {
    const raw = await apiFetch<Record<string, unknown>>(
      `/insights/${storeId}/demand/refresh`,
      { method: 'POST', authToken: token },
    );
    const searches = (raw.top_searches ?? []) as Array<Record<string, unknown>>;
    const trends   = (raw.trend_keywords ?? []) as Array<Record<string, unknown>>;
    const gaps     = (raw.gaps ?? []) as Array<Record<string, unknown>>;
    return {
      topSearches: searches.map((s) => ({ query: s.query as string, count: s.count as number, zeroResults: s.zero_results as boolean })),
      trendingKeywords: trends.map((t) => ({ keyword: t.keyword as string, score: (t.interest ?? 0) as number, delta: 0 })),
      demandGaps: gaps.map((g, i) => ({ id: (g.id ?? String(i)) as string, signal: g.signal as string, severity: g.severity as 'high' | 'medium' | 'low', category: g.category as string | undefined, action: g.action as string | undefined })),
      productCategories: (raw.product_categories ?? []) as string[],
      generatedAt: new Date().toISOString(),
    };
  },

  getProfile: async (token: string): Promise<StoreProfile> => {
    const raw = await apiFetch<{
      store_name: string;
      store_url: string;
      niche: string | null;
      location_country: string | null;
      location_city: string | null;
      plugin_site_url: string | null;
    }>('/auth/profile', { authToken: token });
    return {
      storeName: raw.store_name,
      storeUrl: raw.store_url,
      niche: raw.niche,
      locationCountry: raw.location_country,
      locationCity: raw.location_city,
      pluginSiteUrl: raw.plugin_site_url,
    };
  },

  updateProfile: async (token: string, data: UpdateProfileData): Promise<StoreProfile> => {
    const raw = await apiFetch<{
      store_name: string;
      store_url: string;
      niche: string | null;
      location_country: string | null;
      location_city: string | null;
      plugin_site_url: string | null;
    }>('/auth/profile', {
      method: 'PATCH',
      authToken: token,
      body: JSON.stringify({
        store_name: data.storeName,
        store_url: data.storeUrl,
        niche: data.niche,
        location_country: data.locationCountry,
        location_city: data.locationCity,
      }),
    });
    return {
      storeName: raw.store_name,
      storeUrl: raw.store_url,
      niche: raw.niche,
      locationCountry: raw.location_country,
      locationCity: raw.location_city,
      pluginSiteUrl: raw.plugin_site_url,
    };
  },

  activity: async (storeId: string, apiKey: string): Promise<ActivityResponse> => {
    const raw = await apiFetch<Record<string, unknown>>(`/insights/${storeId}/activity`, { apiKey });

    // heatmap is [{hour, active_users}], frontend expects [{hour: number, activeUsers}]
    const heatmap = (raw.heatmap ?? raw.hourly ?? []) as Array<Record<string, unknown>>;
    const peaks   = (raw.peak_hours ?? raw.peakHours ?? []) as Array<unknown>;

    const hourly: HourlyActivity[] = heatmap.map((h) => ({
      hour:        new Date(h.hour as string).getHours(),
      activeUsers: (h.active_users ?? h.activeUsers ?? 0) as number,
    }));

    const peakHours: PeakHour[] = peaks.map((p) => {
      if (typeof p === 'string') {
        const h = parseInt(p.split(':')[0], 10);
        return { hour: h, activeUsers: 0, label: p };
      }
      const po = p as Record<string, unknown>;
      return {
        hour:        (po.hour ?? 0) as number,
        activeUsers: (po.activeUsers ?? po.active_users ?? 0) as number,
        label:       (po.label ?? '') as string,
      };
    });

    const dailyRaw = (raw.daily ?? []) as Array<Record<string, unknown>>;
    const daily: DailyActivity[] = dailyRaw.map((d) => ({
      date: d.date as string,
      activeUsers: (d.active_users ?? d.activeUsers ?? 0) as number,
      pageViews: (d.page_views ?? d.pageViews ?? 0) as number,
    }));

    return {
      hourly,
      daily,
      peakHours,
      totalUniqueVisitors: (raw.avg_daily_users ?? raw.totalUniqueVisitors ?? 0) as number,
      generatedAt: (raw.generatedAt ?? new Date().toISOString()) as string,
    };
  },
};
