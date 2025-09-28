import type { ApiRequestOptions } from '$lib/api/client';
import { apiClient } from '$lib/api/client';

export type ApiFetchOptions = ApiRequestOptions;

export const apiFetch = (input: string, init: ApiFetchOptions = {}) =>
  apiClient.request(input, init);
