/**
 * CareKit — AuthController Unit Tests (delegation tests)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../../src/modules/auth/auth.controller.js';
import { AuthService } from '../../../src/modules/auth/auth.service.js';
import { CookieService } from '../../../src/modules/auth/cookie.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { EmailThrottleGuard } from '../../../src/common/guards/email-throttle.guard.js';
import { OtpType } from '../../../src/modules/auth/enums/otp-type.enum.js';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  getUserProfile: jest.fn(),
  findUserByEmail: jest.fn(),
  generateOtp: jest.fn(),
  sendOtpEmail: jest.fn(),
  verifyOtp: jest.fn(),
  refreshToken: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  verifyEmail: jest.fn(),
};

const mockCookieService = {
  setRefreshTokenCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
  extractRefreshToken: jest.fn(),
};

const mockRes = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const mockReq = (cookies: Record<string, string> = {}) => ({
  cookies,
  headers: {},
});

// ── Fixtures ─────────────────────────────────────────────────────────────

const authResult = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
  user: { id: 'user-1', email: 'test@example.com' },
};

// ── Tests ────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: CookieService, useValue: mockCookieService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EmailThrottleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ─── register ───────────────────────────────────────────────────────

  describe('register', () => {
    it('should delegate to authService.register and set refresh cookie', async () => {
      mockAuthService.register.mockResolvedValue(authResult);
      const res = mockRes();

      const result = await controller.register(
        { email: 'new@example.com', password: 'pass123' } as any,
        res as any,
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalledWith(
        res,
        'refresh-token',
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  // ─── login ──────────────────────────────────────────────────────────

  describe('login', () => {
    it('should delegate to authService.validateUser then login', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue(authResult);
      const res = mockRes();

      const result = await controller.login(
        { email: 'test@example.com', password: 'pass123' } as any,
        res as any,
      );

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'test@example.com',
        'pass123',
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(user);
      expect(mockCookieService.setRefreshTokenCookie).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedException if user validation fails', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);
      const res = mockRes();

      await expect(
        controller.login(
          { email: 'bad@example.com', password: 'wrong' } as any,
          res as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should delegate to authService.logout and clear cookie', async () => {
      mockCookieService.extractRefreshToken.mockReturnValue('refresh-token');
      const req = mockReq({ refresh_token: 'refresh-token' });
      const res = mockRes();

      const result = await controller.logout(
        { refreshToken: 'refresh-token' } as any,
        req as any,
        res as any,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-token');
      expect(mockCookieService.clearRefreshTokenCookie).toHaveBeenCalledWith(
        res,
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
    });

    it('should still clear cookie even when no token', async () => {
      mockCookieService.extractRefreshToken.mockReturnValue(undefined);
      const req = mockReq();
      const res = mockRes();

      const result = await controller.logout(
        { refreshToken: undefined } as any,
        req as any,
        res as any,
      );

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockCookieService.clearRefreshTokenCookie).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // ─── getProfile (me) ────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should delegate to authService.getUserProfile', async () => {
      const profile = { id: 'user-1', email: 'test@example.com', name: 'Test' };
      mockAuthService.getUserProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('user-1');

      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(profile);
    });
  });

  // ─── sendLoginOtp ───────────────────────────────────────────────────

  describe('sendLoginOtp', () => {
    it('should generate OTP and send email when user exists', async () => {
      mockAuthService.findUserByEmail.mockResolvedValue({ id: 'user-1' });
      mockAuthService.generateOtp.mockResolvedValue('123456');

      const result = await controller.sendLoginOtp({
        email: 'test@example.com',
      } as any);

      expect(mockAuthService.findUserByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(mockAuthService.generateOtp).toHaveBeenCalledWith(
        'user-1',
        OtpType.LOGIN,
      );
      expect(mockAuthService.sendOtpEmail).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'login',
      );
      expect(result.success).toBe(true);
    });

    it('should return success even if user does not exist (security)', async () => {
      mockAuthService.findUserByEmail.mockResolvedValue(null);

      const result = await controller.sendLoginOtp({
        email: 'unknown@example.com',
      } as any);

      expect(mockAuthService.generateOtp).not.toHaveBeenCalled();
      expect(mockAuthService.sendOtpEmail).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // ─── verifyLoginOtp ─────────────────────────────────────────────────

  describe('verifyLoginOtp', () => {
    it('should verify OTP then login and set cookie', async () => {
      const userPayload = { id: 'user-1', email: 'test@example.com' };
      mockAuthService.verifyOtp.mockResolvedValue(userPayload);
      mockAuthService.login.mockResolvedValue(authResult);
      const res = mockRes();

      const result = await controller.verifyLoginOtp(
        { email: 'test@example.com', code: '123456' } as any,
        res as any,
      );

      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        OtpType.LOGIN,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(userPayload);
      expect(result).toHaveProperty('accessToken');
    });
  });

  // ─── refreshToken ───────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('should use cookie token when available', async () => {
      mockCookieService.extractRefreshToken.mockReturnValue('cookie-token');
      const newTokens = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 3600,
      };
      mockAuthService.refreshToken.mockResolvedValue(newTokens);
      const req = mockReq({ refresh_token: 'cookie-token' });
      const res = mockRes();

      const result = await controller.refreshToken(
        { refreshToken: 'body-token' } as any,
        req as any,
        res as any,
      );

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('cookie-token');
      expect(result).toHaveProperty('accessToken');
    });

    it('should use body token when no cookie token', async () => {
      mockCookieService.extractRefreshToken.mockReturnValue(undefined);
      const newTokens = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 3600,
      };
      mockAuthService.refreshToken.mockResolvedValue(newTokens);
      const req = mockReq();
      const res = mockRes();

      const result = await controller.refreshToken(
        { refreshToken: 'body-token' } as any,
        req as any,
        res as any,
      );

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('body-token');
      expect(result).toHaveProperty('accessToken');
      // Mobile compatibility: refreshToken included in response
      expect((result as Record<string, unknown>).refreshToken).toBe(
        'new-refresh',
      );
    });

    it('should throw UnauthorizedException when no token at all', async () => {
      mockCookieService.extractRefreshToken.mockReturnValue(undefined);
      const req = mockReq();
      const res = mockRes();

      await expect(
        controller.refreshToken(
          { refreshToken: undefined } as any,
          req as any,
          res as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should generate and send OTP when user exists', async () => {
      mockAuthService.findUserByEmail.mockResolvedValue({ id: 'user-1' });
      mockAuthService.generateOtp.mockResolvedValue('654321');

      const result = await controller.forgotPassword({
        email: 'test@example.com',
      } as any);

      expect(mockAuthService.generateOtp).toHaveBeenCalledWith(
        'user-1',
        OtpType.RESET_PASSWORD,
      );
      expect(mockAuthService.sendOtpEmail).toHaveBeenCalledWith(
        'test@example.com',
        '654321',
        'reset_password',
      );
      expect(result.success).toBe(true);
    });

    it('should return success even when user not found (security)', async () => {
      mockAuthService.findUserByEmail.mockResolvedValue(null);

      const result = await controller.forgotPassword({
        email: 'unknown@example.com',
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain('sent');
    });
  });

  // ─── resetPassword ──────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should delegate to authService.resetPassword', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPass123!',
      } as any);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'NewPass123!',
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset');
    });
  });
});
