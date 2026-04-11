export interface UserPayload {
  id: string
  email: string
  name: string
  nameAr: string
  role: string
  clinicId: string
  permissions: string[]
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthResponse extends TokenPair {
  user: UserPayload
}
