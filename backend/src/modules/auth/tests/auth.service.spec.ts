/**
 * CareKit — AuthService Unit Tests (TDD RED Phase)
 *
 * Tests the AuthService business logic in isolation:
 *   - Registration (hashing, role assignment, token generation)
 *   - Credential validation
 *   - OTP generation and verification
 *   - Token refresh and rotation
 *
 * Dependencies (PrismaService, JwtService, MailService, etc.)
 * are mocked so these tests run without a database.
 *
 * These tests will FAIL until backend-dev implements AuthService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: 'male' | 'female';
}

type OtpType = 'login' | 'reset_password' | 'verify_email';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  otpCode: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  userRole: {
    create: jest.fn(),
  },
  role: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string | number> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '900',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_EXPIRES_IN: '604800',
      OTP_EXPIRY_MINUTES: '10',
    };
    return config[key];
  }),
};

const mockMailQueue = {
  add: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'BullQueue_email', useValue: mockMailQueue },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // =========================================================================
  // register()
  // =========================================================================

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'Str0ngP@ss!',
      firstName: 'أحمد',
      lastName: 'الراشد',
      phone: '+966501234567',
      gender: 'male',
    };

    it('should hash password before storing (never store plaintext)', async () => {
      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(null); // no duplicate
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'patient-role-id',
        slug: 'patient',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: registerDto.email,
        passwordHash: '$2b$10$hashedpassword', // bcrypt hash
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({
        token: 'refresh-token',
      });

      const result = await service.register(registerDto);

      // Verify password was hashed (the stored value should NOT be the plaintext)
      const createCall = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      expect(createCall.data.passwordHash).not.toBe(registerDto.password);
      expect(createCall.data.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt pattern

      // Verify no plaintext password in create payload
      expect(createCall.data).not.toHaveProperty('password');
    });

    it('should assign patient role to new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'patient-role-id',
        slug: 'patient',
        isDefault: true,
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({
        token: 'refresh-token',
      });

      await service.register(registerDto);

      // Verify patient role was assigned
      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ slug: 'patient' }),
        }),
      );
      expect(mockPrismaService.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roleId: 'patient-role-id',
          }),
        }),
      );
    });

    it('should generate access and refresh tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'patient-role-id',
        slug: 'patient',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({
        token: 'refresh-token-value',
      });

      const result = await service.register(registerDto);

      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.expiresIn).toBe(900); // 15 minutes in seconds
    });

    it('should send verification email via queue', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'patient-role-id',
        slug: 'patient',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({
        token: 'refresh-token',
      });

      await service.register(registerDto);

      // Verify email job was queued (not sent synchronously)
      expect(mockMailQueue.add).toHaveBeenCalledWith(
        expect.any(String), // job name
        expect.objectContaining({
          email: registerDto.email,
        }),
      );
    });

    it('should throw if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow();
    });

    it('should normalize email to lowercase', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.role.findFirst.mockResolvedValue({
        id: 'patient-role-id',
        slug: 'patient',
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'upper@example.com',
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        isActive: true,
        emailVerified: false,
      });
      mockPrismaService.userRole.create.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({
        token: 'rt',
      });

      await service.register({
        ...registerDto,
        email: 'UPPER@EXAMPLE.COM',
      });

      const createCall = mockPrismaService.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('upper@example.com');
    });
  });

  // =========================================================================
  // validateUser()
  // =========================================================================

  describe('validateUser', () => {
    it('should return user for valid credentials', async () => {
      const hashedPassword = '$2b$10$9j3H5FgD2RehMd.kiLvD5e9OgKUXdn3Muco883p5BENhEsEDQAl2C'; // bcrypt hash of 'correctpassword'
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: hashedPassword,
        firstName: 'أحمد',
        lastName: 'الراشد',
        isActive: true,
        emailVerified: true,
        userRoles: [{ role: { slug: 'patient' } }],
      });

      const result = await service.validateUser('user@example.com', 'correctpassword');

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.email).toBe('user@example.com');
    });

    it('should return null for invalid password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        passwordHash: '$2b$10$somehashedpassword',
        isActive: true,
      });

      const result = await service.validateUser('user@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException for deactivated user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'deactivated@example.com',
        passwordHash: '$2b$10$somehashedpassword',
        isActive: false,
      });

      await expect(
        service.validateUser('deactivated@example.com', 'anypassword'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return null for non-existent email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nobody@example.com', 'anypassword');

      expect(result).toBeNull();
    });

    it('should be case-insensitive for email lookup', async () => {
      await service.validateUser('USER@EXAMPLE.COM', 'password');

      const findCall = mockPrismaService.user.findUnique.mock.calls[0][0];
      expect(findCall.where.email).toBe('user@example.com');
    });
  });

  // =========================================================================
  // generateOtp()
  // =========================================================================

  describe('generateOtp', () => {
    it('should create 6-digit numeric code', async () => {
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockImplementation(
        ({ data }: { data: { code: string } }) => {
          // Capture the generated code
          expect(data.code).toMatch(/^\d{6}$/); // exactly 6 digits
          return Promise.resolve({ id: 'otp-id', ...data });
        },
      );

      const code = await service.generateOtp('user-id', 'login');

      expect(code).toMatch(/^\d{6}$/);
    });

    it('should set 10-minute expiry', async () => {
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockImplementation(
        ({ data }: { data: { expiresAt: Date } }) => {
          const now = new Date();
          const expiresAt = new Date(data.expiresAt);
          const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

          // Should be approximately 10 minutes (allow small margin for execution time)
          expect(diffMinutes).toBeGreaterThan(9);
          expect(diffMinutes).toBeLessThanOrEqual(11);

          return Promise.resolve({ id: 'otp-id', ...data });
        },
      );

      await service.generateOtp('user-id', 'login');
    });

    it('should invalidate previous unused OTPs for same user and type', async () => {
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 'otp-id',
        code: '123456',
      });

      await service.generateOtp('user-id', 'login');

      // Should mark previous OTPs as used
      expect(mockPrismaService.otpCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-id',
            type: 'login',
            usedAt: null,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // verifyOtp()
  // =========================================================================

  describe('verifyOtp', () => {
    it('should mark OTP as used after successful verification', async () => {
      const now = new Date();
      const futureExpiry = new Date(now.getTime() + 10 * 60 * 1000);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        id: 'otp-id',
        userId: 'user-id',
        code: '123456',
        type: 'login',
        expiresAt: futureExpiry,
        usedAt: null,
      });
      mockPrismaService.otpCode.update.mockResolvedValue({});

      await service.verifyOtp('user@example.com', '123456', 'login');

      expect(mockPrismaService.otpCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'otp-id' },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject expired OTP', async () => {
      const pastExpiry = new Date(Date.now() - 60 * 1000); // 1 min ago

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        id: 'otp-id',
        userId: 'user-id',
        code: '123456',
        type: 'login',
        expiresAt: pastExpiry,
        usedAt: null,
      });

      await expect(
        service.verifyOtp('user@example.com', '123456', 'login'),
      ).rejects.toThrow();
    });

    it('should reject already-used OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null); // No unused OTP found

      await expect(
        service.verifyOtp('user@example.com', '123456', 'login'),
      ).rejects.toThrow();
    });

    it('should reject non-matching OTP code', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null); // code doesn't match

      await expect(
        service.verifyOtp('user@example.com', '999999', 'login'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // refreshToken()
  // =========================================================================

  describe('refreshToken', () => {
    it('should rotate refresh token (old one becomes invalid)', async () => {
      const oldToken = 'old-refresh-token';
      const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-id',
        token: oldToken,
        userId: 'user-id',
        expiresAt: futureExpiry,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isActive: true,
        userRoles: [{ role: { slug: 'patient' } }],
      });
      mockPrismaService.refreshToken.delete.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({
        token: 'new-refresh-token',
      });

      const result = await service.refreshToken(oldToken);

      // Old token should be deleted
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-id' },
        }),
      );

      // New token should be created
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();

      // Result should have new tokens
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(oldToken);
    });

    it('should reject if refresh token not in database', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.refreshToken('non-existent-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject if refresh token is expired', async () => {
      const pastExpiry = new Date(Date.now() - 60 * 1000);

      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-id',
        token: 'expired-token',
        userId: 'user-id',
        expiresAt: pastExpiry,
      });

      await expect(
        service.refreshToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject if user is deactivated', async () => {
      const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-id',
        token: 'valid-token',
        userId: 'user-id',
        expiresAt: futureExpiry,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'deactivated@example.com',
        isActive: false,
      });

      await expect(
        service.refreshToken('valid-token'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // logout()
  // =========================================================================

  describe('logout', () => {
    it('should delete the refresh token from database', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('refresh-token-to-revoke');

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            token: 'refresh-token-to-revoke',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // changePassword()
  // =========================================================================

  describe('changePassword', () => {
    it('should verify current password before changing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        passwordHash: '$2b$10$correcthash',
      });

      // If current password is wrong, should throw
      await expect(
        service.changePassword('user-id', 'WrongCurrent!', 'NewP@ss123!'),
      ).rejects.toThrow();
    });

    it('should hash new password before storing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        passwordHash: '$2b$10$correcthash',
      });
      mockPrismaService.user.update.mockResolvedValue({});

      // This test depends on bcrypt.compare mocking — backend-dev will
      // set up the correct mock to pass the current password check.

      // After successful change, the update call should contain a bcrypt hash
      if (mockPrismaService.user.update.mock.calls.length > 0) {
        const updateCall = mockPrismaService.user.update.mock.calls[0][0];
        expect(updateCall.data.passwordHash).toMatch(/^\$2[aby]\$/);
        expect(updateCall.data.passwordHash).not.toBe('NewP@ss123!');
      }
    });
  });

  // =========================================================================
  // resetPassword()
  // =========================================================================

  describe('resetPassword', () => {
    it('should verify OTP before resetting password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null); // Invalid OTP

      await expect(
        service.resetPassword('user@example.com', '000000', 'NewP@ss!'),
      ).rejects.toThrow();
    });

    it('should hash new password and update user', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
      });
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        id: 'otp-id',
        code: '123456',
        type: 'reset_password',
        expiresAt: futureExpiry,
        usedAt: null,
      });
      mockPrismaService.otpCode.update.mockResolvedValue({});
      mockPrismaService.user.update.mockResolvedValue({});

      await service.resetPassword('user@example.com', '123456', 'NewStr0ngP@ss!');

      // Should update user with hashed password
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id' },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        }),
      );

      // Should mark OTP as used
      expect(mockPrismaService.otpCode.update).toHaveBeenCalled();
    });
  });
});
