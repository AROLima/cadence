import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const API_BASE_URL = (env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const POST = async ({ cookies, fetch }) => {
  const accessToken = cookies.get('accessToken');

  if (accessToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.warn('[logout] Backend logout failed', error);
    }
  }

  cookies.delete('accessToken', { path: '/' });
  cookies.delete('refreshToken', { path: '/' });

  return json({ success: true });
};
