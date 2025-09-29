import { apiClient } from './client';

export type InfraSettings = {
  rateLimit: { windowMs: number; adminMax: number };
  allowlist: string[];
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getInfraSettings(): Promise<InfraSettings> {
  const res = await apiClient.json<ApiResponse<InfraSettings>>('/admin/infra');
  return res.data;
}

export async function updateInfraSettings(patch: Partial<InfraSettings>): Promise<InfraSettings> {
  const res = await apiClient.json<ApiResponse<InfraSettings>>('/admin/infra', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.data;
}
