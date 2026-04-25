import '@/lib/api-client'; // ensure initClient runs before any authApi call
import { authApi } from '@carekit/api-client';
import type { AuthResponse, LoginPayload } from '@carekit/api-client';

export type LoginRequest = LoginPayload;
export type LoginResponse = AuthResponse;

export function login(body: LoginRequest): Promise<LoginResponse> {
  return authApi.login(body);
}
