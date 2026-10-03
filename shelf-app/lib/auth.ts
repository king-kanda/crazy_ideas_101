const TOKEN_KEY = 'palda_token';
const API_KEY_KEY = 'palda_api_key';
const STORE_ID_KEY = 'palda_store_id';
const STORE_NAME_KEY = 'palda_store_name';
const STORE_URL_KEY = 'palda_store_url';
const WORKSPACE_ID_KEY = 'palda_workspace_id';
const MERCHANT_ID_KEY = 'palda_merchant_id';

export interface AuthState {
  token: string;
  workspaceId: string;
  merchantId: string;
  apiKey: string;
  storeId: string;
  storeName: string;
  storeUrl: string;
  /** True once the merchant has connected a store (api key + store id present). */
  hasStore: boolean;
}

export interface SaveAuthInput {
  token: string;
  workspaceId: string;
  merchantId: string;
  apiKey?: string;
  storeId?: string;
  storeName?: string;
  storeUrl?: string;
}

export function saveAuth(input: SaveAuthInput): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, input.token);
  localStorage.setItem(WORKSPACE_ID_KEY, input.workspaceId);
  localStorage.setItem(MERCHANT_ID_KEY, input.merchantId);
  // Store fields are optional — an OAuth signup has a workspace but no store yet.
  if (input.apiKey) localStorage.setItem(API_KEY_KEY, input.apiKey);
  if (input.storeId) localStorage.setItem(STORE_ID_KEY, input.storeId);
  if (input.storeName) localStorage.setItem(STORE_NAME_KEY, input.storeName);
  if (input.storeUrl) localStorage.setItem(STORE_URL_KEY, input.storeUrl);
}

export function getAuth(): AuthState | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const workspaceId = localStorage.getItem(WORKSPACE_ID_KEY);
  const merchantId = localStorage.getItem(MERCHANT_ID_KEY);
  // Identity is now merchant/workspace-centric; a store is no longer required to be authed.
  if (!token || !workspaceId || !merchantId) return null;
  const apiKey = localStorage.getItem(API_KEY_KEY) ?? '';
  const storeId = localStorage.getItem(STORE_ID_KEY) ?? '';
  return {
    token,
    workspaceId,
    merchantId,
    apiKey,
    storeId,
    storeName: localStorage.getItem(STORE_NAME_KEY) ?? '',
    storeUrl: localStorage.getItem(STORE_URL_KEY) ?? '',
    hasStore: Boolean(apiKey && storeId),
  };
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  [
    TOKEN_KEY,
    API_KEY_KEY,
    STORE_ID_KEY,
    STORE_NAME_KEY,
    STORE_URL_KEY,
    WORKSPACE_ID_KEY,
    MERCHANT_ID_KEY,
  ].forEach((k) => localStorage.removeItem(k));
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}
