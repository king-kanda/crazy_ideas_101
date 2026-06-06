const TOKEN_KEY = 'shelf_token';
const API_KEY_KEY = 'shelf_api_key';
const STORE_ID_KEY = 'shelf_store_id';
const STORE_NAME_KEY = 'shelf_store_name';
const STORE_URL_KEY = 'shelf_store_url';

export function saveAuth(
  token: string,
  apiKey: string,
  storeId: string,
  storeName?: string,
  storeUrl?: string,
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(API_KEY_KEY, apiKey);
  localStorage.setItem(STORE_ID_KEY, storeId);
  if (storeName) localStorage.setItem(STORE_NAME_KEY, storeName);
  if (storeUrl) localStorage.setItem(STORE_URL_KEY, storeUrl);
}

export function getAuth(): {
  token: string;
  apiKey: string;
  storeId: string;
  storeName: string;
  storeUrl: string;
} | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const apiKey = localStorage.getItem(API_KEY_KEY);
  const storeId = localStorage.getItem(STORE_ID_KEY);
  if (!token || !apiKey || !storeId) return null;
  return {
    token,
    apiKey,
    storeId,
    storeName: localStorage.getItem(STORE_NAME_KEY) ?? '',
    storeUrl: localStorage.getItem(STORE_URL_KEY) ?? '',
  };
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(API_KEY_KEY);
  localStorage.removeItem(STORE_ID_KEY);
  localStorage.removeItem(STORE_NAME_KEY);
  localStorage.removeItem(STORE_URL_KEY);
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}
