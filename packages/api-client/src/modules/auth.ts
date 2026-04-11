import { apiRequest } from '../client.js'
import type { AuthResponse, TokenPair } from '../types/index.js'

export interface LoginPayload {
  email: string
  password: string
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

export async function getMe(): Promise<AuthResponse['user']> {
  return apiRequest('/auth/me')
}
