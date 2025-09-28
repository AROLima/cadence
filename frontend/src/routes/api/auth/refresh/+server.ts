import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const base = env.API_BASE_URL || env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE_URL = base.replace(/\/$/, '');
const secure = env.NODE_ENV === 'production';

export const POST = async ({ cookies, fetch }) => {
  const refreshToken = cookies.get('refreshToken');

  if (!refreshToken) {
    cookies.delete('accessToken', { path: '/' });
    cookies.delete('refreshToken', { path: '/' });
    return json({ success: false, message: 'Refresh token missing' }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    cookies.delete('accessToken', { path: '/' });
    cookies.delete('refreshToken', { path: '/' });
    return json({ success: false, message: 'Unable to refresh session' }, { status: response.status });
  }

  const payload = await response.json();

  if (!payload?.success) {
    cookies.delete('accessToken', { path: '/' });
    cookies.delete('refreshToken', { path: '/' });
    return json({ success: false, message: payload?.message ?? 'Unable to refresh session' }, { status: 401 });
  }

  const { accessToken, refreshToken: nextRefreshToken, user } = payload.data;

  cookies.set('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60,
  });

  cookies.set('refreshToken', nextRefreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return json({
    success: true,
    data: {
      accessToken,
      refreshToken: nextRefreshToken,
      user,
    },
  });
};
