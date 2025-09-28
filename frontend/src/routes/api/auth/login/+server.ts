import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const base = env.API_BASE_URL || env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE_URL = base.replace(/\/$/, '');
const secure = env.NODE_ENV === 'production';

export const POST = async ({ request, fetch, cookies }) => {
  const body = await request.json();

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    return json(errorPayload ?? { success: false, message: 'Login failed' }, { status: response.status });
  }

  const payload = await response.json();

  if (!payload?.success) {
    return json(payload ?? { success: false, message: 'Login failed' }, { status: 400 });
  }

  const { accessToken, refreshToken, user } = payload.data;

  cookies.set('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60,
  });

  cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return json({
    success: true,
    data: { accessToken, refreshToken, user },
  });
};
