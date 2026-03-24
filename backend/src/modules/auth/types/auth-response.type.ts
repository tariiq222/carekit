import { UserPayload } from '../../../common/types/user-payload.type.js';

export interface AuthResponse {
  user: UserPayload;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
