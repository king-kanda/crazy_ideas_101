const TOKEN_KEY = 'shelf_token';
const API_KEY_KEY = 'shelf_api_key';
const STORE_ID_KEY = 'shelf_store_id';

export function saveAuth(token: string, apiKey: string, storeId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(API_KEY_KEY, apiKey);
  localStorage.setItem(STORE_ID_KEY, storeId);
}

export function getAuth(): { token: string; apiKey: string; storeId: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const apiKey = localStorage.getItem(API_KEY_KEY);
  const storeId = localStorage.getItem(STORE_ID_KEY);
  if (!token || !apiKey || !storeId) return null;
  return { token, apiKey, storeId };
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(API_KEY_KEY);
  localStorage.removeItem(STORE_ID_KEY);
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}
