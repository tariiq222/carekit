import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientLoginHandler } from './client-login.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';

describe('ClientLoginHandler', () => {
  let handler: ClientLoginHandler;

  const mockPrisma = {
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    clientRefreshToken: {
      create: jest.fn(),
    },
  };

  const mockRedisClient = {
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };

  const mockRedis = { getClient: jest.fn(() => mockRedisClient) };
  const mockJwt = { sign: jest.fn(() => 'mock-access-token') };
  const mockConfig = { get: jest.fn(), getOrThrow: jest.fn((k: string) => k) };
  const mockPasswords = { verify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientLoginHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PasswordService, useValue: mockPasswords },
      ],
    }).compile();

    handler = module.get<ClientLoginHandler>(ClientLoginHandler);
  });

  describe('execute', () => {
    it('returns tokens on successful login', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-1',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 0,
        lockoutUntil: null,
      });
      mockRedisClient.incr.mockResolvedValue(1);
      mockPasswords.verify.mockResolvedValue(true);

      const result = await handler.execute({
        email: 'test@example.com',
        password: 'SecurePass123',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.clientId).toBe('cl-1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('client_login:test@example.com');
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(mockPrisma.clientRefreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'cl-1',
          tokenHash: expect.any(String),
        }),
      });
    });

    it('throws Unauthorized for non-existent client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({ email: 'nobody@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized for locked account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-2',
        email: 'locked@example.com',
        passwordHash: 'hashed_pw',
        lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
      });

      await expect(
        handler.execute({ email: 'locked@example.com', password: 'SecurePass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized for wrong password', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-3',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 0,
        lockoutUntil: null,
      });
      mockRedisClient.incr.mockResolvedValue(2);
      mockPasswords.verify.mockResolvedValue(false);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-3' });

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-3' },
        data: { loginAttempts: { increment: 1 }, lockoutUntil: undefined },
      });
    });

    it('locks account after 5 failed attempts', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-4',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 4,
        lockoutUntil: null,
      });
      mockRedisClient.incr.mockResolvedValue(5);
      mockPasswords.verify.mockResolvedValue(false);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-4' });

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-4' },
        data: {
          loginAttempts: { increment: 1 },
          lockoutUntil: expect.any(Date),
        },
      });
    });

    it('throws Unauthorized when rate limit exceeded', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-5',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        lockoutUntil: null,
      });
      mockRedisClient.incr.mockResolvedValue(6);

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
