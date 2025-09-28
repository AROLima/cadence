import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

function sanitize(url?: string | null) {
  return url ? url.replace(/\/$/, '') : undefined;
}

// Prefer IPv4 loopback to avoid IPv6 (::1) localhost resolution issues on Windows during SSR
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

export const API_BASE_URL =
  sanitize(publicEnv?.PUBLIC_API_BASE_URL) ??
  (browser ? DEFAULT_BASE_URL : DEFAULT_BASE_URL);
