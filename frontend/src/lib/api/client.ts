import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { API_BASE_URL } from '$lib/config';
import { authStore, type AuthState } from '$lib/stores/auth';

export interface ApiRequestOptions extends globalThis.RequestInit {
  baseUrl?: string;
  skipAuth?: boolean;
  retry?: boolean;
  // optional retry configuration for 429s
  retry429?: {
    maxRetries?: number; // default 2
    baseDelayMs?: number; // default 250
  };
}

interface RefreshResponse {
  success: boolean;
  data?: AuthState;
  message?: string;
}

async function refreshTokens(): Promise<AuthState | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RefreshResponse;
    if (!payload?.success || !payload.data) {
      return null;
    }

    authStore.setAuth(payload.data);
    return payload.data;
  } catch (error) {
    console.error('[apiClient] refresh failed', error);
    return null;
  }
}

function resolveUrl(input: string, baseUrl: string): string {
  if (input.startsWith('http')) {
    return input;
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = input.startsWith('/') ? input : `/${input}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function performFetch(
  input: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const { baseUrl = API_BASE_URL, skipAuth = false, ...init } = options;
  const target = resolveUrl(input, baseUrl);
  const headers = new Headers(init.headers ?? {});

  if (!skipAuth) {
    const state = get(authStore);
    if (state?.accessToken) {
      headers.set('Authorization', `Bearer ${state.accessToken}`);
    }
  }

  // Do not include credentials (cookies) by default for cross-origin API calls.
  // We authenticate via Authorization header; cookies are only used on server-bound
  // routes like /api/auth/refresh (same-origin), which already include cookies by default.
  return fetch(target, {
    ...init,
    headers,
    credentials: options.credentials ?? init.credentials ?? 'same-origin',
  });
}

async function requestWithRetry(
  input: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  // Inner runner with optional 429 retry for safe/idempotent requests
  const attempt = async (attemptNo: number): Promise<Response> => {
    const resp = await performFetch(input, options);

    // 401 -> try token refresh once (client-side only)
    if (resp.status === 401 && !options.skipAuth && browser && !options.retry) {
      const refreshed = await refreshTokens();
      if (!refreshed?.accessToken) {
        authStore.clearAuth();
        goto('/login');
        return resp;
      }
      const retryHeaders = new Headers(options.headers ?? {});
      retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);
      return performFetch(input, { ...options, headers: retryHeaders, retry: true });
    }

    // 429 -> exponential backoff retry for GET/HEAD only
    if (
      resp.status === 429 &&
      (options.method == null || /^(get|head)$/i.test(String(options.method)))
    ) {
      const { maxRetries = 2, baseDelayMs = 250 } = options.retry429 ?? {};
      if (attemptNo < maxRetries) {
        const jitter = Math.random() * baseDelayMs;
        const delay = baseDelayMs * Math.pow(2, attemptNo) + jitter;
        await new Promise((r) => setTimeout(r, delay));
        return attempt(attemptNo + 1);
      }
    }

    return resp;
  };

  return attempt(0);
}

async function requestJson<T>(
  input: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await requestWithRetry(input, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export const apiClient = {
  request: requestWithRetry,
  json: requestJson,
};

export type ApiClient = typeof apiClient;
