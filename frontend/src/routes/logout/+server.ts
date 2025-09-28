import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const base = env.API_BASE_URL || env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE_URL = base.replace(/\/$/, '');

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
