const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Request types ──────────────────────────────────────────────

export interface SignupData {
  email: string;
  password: string;
  storeName?: string;
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
  email: string;
}

export interface VerifyResponse {
  verified: boolean;
  storeId: string;
  storeName: string;
  lastSync?: string;
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
}

export interface DemandResponse {
  topSearches: SearchQuery[];
  trendingKeywords: TrendingKeyword[];
  demandGaps: DemandGap[];
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

export interface ActivityResponse {
  hourly: HourlyActivity[];
  peakHours: PeakHour[];
  totalUniqueVisitors: number;
  generatedAt: string;
}

// ── Fetch wrapper ──────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { apiKey?: string }
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.apiKey) headers['X-Shelf-API-Key'] = options.apiKey;

  const { apiKey: _apiKey, ...restOptions } = options ?? {};
  const res = await fetch(`${API_URL}${path}`, { ...restOptions, headers });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── API surface ────────────────────────────────────────────────

export const api = {
  signup: (data: SignupData) =>
    apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginData) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verify: (apiKey: string) =>
    apiFetch<VerifyResponse>('/auth/verify', { apiKey }),

  demand: (storeId: string, apiKey: string) =>
    apiFetch<DemandResponse>(`/insights/${storeId}/demand`, { apiKey }),

  store: (storeId: string, apiKey: string) =>
    apiFetch<StoreResponse>(`/insights/${storeId}/store`, { apiKey }),

  activity: (storeId: string, apiKey: string) =>
    apiFetch<ActivityResponse>(`/insights/${storeId}/activity`, { apiKey }),
};
