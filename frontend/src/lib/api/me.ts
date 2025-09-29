import { apiClient } from './client';

export type MySettings = {
  theme: 'light' | 'dark' | 'system';
  locale: string;
  timezone: string;
  weekStart: 'monday' | 'sunday';
  notifications: { email: boolean; push: boolean };
  currency: string;
};

export type UpdateMySettings = Partial<MySettings> & {
  notifications?: Partial<MySettings['notifications']>;
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getMySettings() {
  const res = await apiClient.json<ApiResponse<MySettings>>('/me/settings');
  return res.data;
}

export async function updateMySettings(patch: UpdateMySettings) {
  const res = await apiClient.json<ApiResponse<MySettings>>('/me/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.data;
}
