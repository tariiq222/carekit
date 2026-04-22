import { publicRequest } from '@/lib/api-client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; isSuperAdmin?: boolean };
}

export function login(body: LoginRequest): Promise<LoginResponse> {
  return publicRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
