import { fail, redirect, type Actions } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const API_BASE_URL = (env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const secure = env.NODE_ENV === 'production';

export const load = async ({ cookies }) => {
  const accessToken = cookies.get('accessToken');
  const refreshToken = cookies.get('refreshToken');

  if (accessToken || refreshToken) {
    throw redirect(302, '/app/dashboard');
  }

  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      return fail(400, { message: 'Email and password are required.' });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        const message = payload?.message ?? 'Invalid credentials.';
        return fail(response.status ?? 400, { message });
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

      throw redirect(302, '/app/dashboard');
    } catch (error) {
      console.error('[login action] Unexpected error', error);
      return fail(500, { message: 'Unable to login. Please try again later.' });
    }
  },
};
