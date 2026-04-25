import { apiRequest } from '../client'
import type {
  AuthResponse,
  ChangePasswordPayload,
  TokenPair,
  UserPayload,
} from '../types/auth'

export interface LoginPayload {
  email: string
  password: string
  hCaptchaToken: string
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function refreshToken(token: string): Promise<TokenPair> {
  return apiRequest<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: token }),
  })
}

export async function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<UserPayload> {
  return apiRequest<UserPayload>('/auth/me')
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  return apiRequest<void>('/auth/password/change', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type { AuthResponse, ChangePasswordPayload, TokenPair, UserPayload }
