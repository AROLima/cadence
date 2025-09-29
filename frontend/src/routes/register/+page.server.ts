import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

const base = env.API_BASE_URL || env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE_URL = base.replace(/\/$/, '');
const secure = env.NODE_ENV === 'production';

export const load: ServerLoad = async ({ cookies }) => {
  const accessToken = cookies.get('accessToken');
  if (accessToken) {
    throw redirect(302, '/app/dashboard');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!name || !email || !password) {
      return fail(400, { success: false, message: 'Name, email and password are required.' });
    }

    let response: Response | null = null;
    let payload: unknown = null;
    try {
      response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      try {
        payload = await response.json();
      } catch {
        // ignore json parse errors
      }
    } catch {
      return fail(503, {
        success: false,
        message:
          'Não foi possível conectar ao servidor. Verifique se o backend está em execução (localhost:3000).',
        email,
        name,
      });
    }

    const ResponseSchema = z.object({
      success: z.boolean(),
      message: z.string().optional(),
      data: z
        .object({
          accessToken: z.string(),
          refreshToken: z.string(),
          user: z.unknown().optional(),
        })
        .optional(),
    });

    const parsed = ResponseSchema.safeParse(payload);

    if (!response!.ok || !parsed.success || !parsed.data.success || !parsed.data.data) {
      const message = (parsed.success ? parsed.data.message : null) ?? 'Registration failed.';
      return fail(response!.status >= 400 && response!.status < 600 ? response!.status : 400, {
        success: false,
        message,
        email,
        name,
      });
    }

    const { accessToken, refreshToken } = parsed.data.data;

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return fail(500, { success: false, message: 'Unexpected registration response.' });
    }

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

    throw redirect(303, '/app/dashboard');
  },
};
