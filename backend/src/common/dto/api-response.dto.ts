export interface ApiResponseDto<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export function createApiResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiResponseDto<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
}
