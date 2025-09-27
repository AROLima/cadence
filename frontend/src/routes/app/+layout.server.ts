import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

const API_BASE_URL = (env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const secure = env.NODE_ENV === 'production';

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user?: Record<string, unknown>;
};

const fetchUser = async (fetch: typeof globalThis.fetch, token: string) => {
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) {
    const payload = await response.json();
    return payload?.data ?? payload;
  }

  if (response.status === 401) {
    return null;
  }

  throw error(response.status, 'Failed to load user profile');
};

const refreshTokens = async (
  fetch: typeof globalThis.fetch,
  refreshToken: string,
): Promise<AuthPayload | null> => {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  if (!payload?.success) {
    return null;
  }

  return payload.data as AuthPayload;
};

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
  let accessToken = cookies.get('accessToken');
  const refreshToken = cookies.get('refreshToken');
  let currentRefreshToken = refreshToken ?? null;

  if (!accessToken && !refreshToken) {
    throw redirect(302, '/login');
  }

  const persistTokens = (tokens: AuthPayload) => {
    cookies.set('accessToken', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60,
    });

    cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    currentRefreshToken = tokens.refreshToken;
  };

  let user = null as Record<string, unknown> | null;

  if (accessToken) {
    user = await fetchUser(fetch, accessToken);
  }

  if (!user && refreshToken) {
    const refreshed = await refreshTokens(fetch, refreshToken);
    if (refreshed?.accessToken) {
      persistTokens(refreshed);
      accessToken = refreshed.accessToken;
      user =
        refreshed.user ?? (await fetchUser(fetch, refreshed.accessToken)) ?? null;
    }
  }

  if (!user || !accessToken) {
    cookies.delete('accessToken', { path: '/' });
    cookies.delete('refreshToken', { path: '/' });
    throw redirect(302, '/login');
  }

  return {
    user,
    tokens: {
      accessToken,
      refreshToken: currentRefreshToken,
    },
  };
};
