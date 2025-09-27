import { browser } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

function sanitize(url?: string | null) {
  return url ? url.replace(/\/$/, '') : undefined;
}

export const API_BASE_URL =
  sanitize(publicEnv?.PUBLIC_API_BASE_URL) ??
  sanitize(privateEnv?.API_BASE_URL) ??
  (browser ? sanitize(window?.location?.origin) ?? 'http://localhost:3000' : 'http://localhost:3000');
