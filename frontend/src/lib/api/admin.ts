import { apiClient } from './client';

export type AdminSettings = {
  companyName: string;
  defaultCurrency: string;
  fiscalMonthStart: number; // 1..12
};

export type AdminSettingsEnvelope = {
  settings: AdminSettings;
  rateLimit: { windowMs: number; adminMax: number };
  allowlist: string[];
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getAdminSettings(): Promise<AdminSettingsEnvelope> {
  const res = await apiClient.json<ApiResponse<AdminSettingsEnvelope>>(
    '/admin/settings',
  );
  return res.data;
}

export async function updateAdminSettings(
  patch: Partial<AdminSettings>,
): Promise<AdminSettings> {
  const res = await apiClient.json<ApiResponse<AdminSettings>>(
    '/admin/settings',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  return res.data;
}
