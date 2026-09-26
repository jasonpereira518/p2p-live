// utils/api.ts
export const API =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_OPS_API_URL ||
  '';

export const REALTIME_URL =
  (import.meta as any).env?.VITE_REALTIME_SERVER_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_OPS_API_URL ||
  '';

const TOKEN_KEY = 'p2p-ops-token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export interface ApiFetchOptions extends RequestInit {
  authRequired?: boolean;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = unknown>(
  pathOrUrl: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { authRequired = false, headers, ...rest } = options;
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`;
  const token = getAuthToken();

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(headers as Record<string, string> | undefined),
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (authRequired && !token) {
    throw new ApiError(401, 'Missing auth token', null);
  }

  const res = await fetch(url, { ...rest, headers: finalHeaders });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in (data as any) && (data as any).error) ||
      res.statusText ||
      'Request failed';
    throw new ApiError(res.status, String(msg), data);
  }
  return data as T;
}
