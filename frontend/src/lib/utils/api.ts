import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { API_BASE_URL } from '$lib/config';
import { authStore, type AuthState } from '$lib/stores/auth';

interface ApiFetchOptions extends RequestInit {}

interface RefreshResponse {
  success: boolean;
  data?: AuthState;
  message?: string;
}

async function callRefreshEndpoint(): Promise<AuthState | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    console.error('[apiFetch] Token refresh failed:', error);
    return null;
  }
}

export async function apiFetch(
  input: string,
  init: ApiFetchOptions = {},
): Promise<Response> {
  const target = input.startsWith('http')
    ? input
    : `${API_BASE_URL}${input.startsWith('/') ? '' : '/'}${input}`;

  const headers = new Headers(init.headers ?? {});
  const state = get(authStore);

  if (state?.accessToken) {
    headers.set('Authorization', `Bearer ${state.accessToken}`);
  }

  const response = await fetch(target, { ...init, headers });

  if (response.status !== 401 || !browser) {
    return response;
  }

  const refreshed = await callRefreshEndpoint();
  if (!refreshed?.accessToken) {
    authStore.clearAuth();
    goto('/login');
    return response;
  }

  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);

  return fetch(target, { ...init, headers: retryHeaders });
}
