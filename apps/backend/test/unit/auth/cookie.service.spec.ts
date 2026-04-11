/**
 * CookieService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CookieService } from '../../../src/modules/auth/cookie.service.js';
import { Response, Request } from 'express';

const mockConfigService: any = {
  get: jest.fn(),
};

describe('CookieService', () => {
  let service: CookieService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CookieService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CookieService>(CookieService);
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined);
  });

  describe('setRefreshTokenCookie', () => {
    it('should set httpOnly cookie with token', () => {
      const mockRes = { cookie: jest.fn() } as unknown as Response;
      mockConfigService.get.mockReturnValue(undefined);

      service.setRefreshTokenCookie(mockRes, 'my-refresh-token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'my-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should set secure=true in production', () => {
      const mockRes = { cookie: jest.fn() } as unknown as Response;
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : undefined,
      );

      service.setRefreshTokenCookie(mockRes, 'token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'token',
        expect.objectContaining({ secure: true }),
      );
    });

    it('should set secure=false in development', () => {
      const mockRes = { cookie: jest.fn() } as unknown as Response;
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'development' : undefined,
      );

      service.setRefreshTokenCookie(mockRes, 'token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'token',
        expect.objectContaining({ secure: false }),
      );
    });

    it('should include COOKIE_DOMAIN when configured', () => {
      const mockRes = { cookie: jest.fn() } as unknown as Response;
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'COOKIE_DOMAIN' ? '.example.com' : undefined,
      );

      service.setRefreshTokenCookie(mockRes, 'token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'token',
        expect.objectContaining({ domain: '.example.com' }),
      );
    });
  });

  describe('clearRefreshTokenCookie', () => {
    it('should clear the refresh_token cookie', () => {
      const mockRes = { clearCookie: jest.fn() } as unknown as Response;

      service.clearRefreshTokenCookie(mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('extractRefreshToken', () => {
    it('should return token from cookies', () => {
      const mockReq = {
        cookies: { refresh_token: 'extracted-token' },
      } as unknown as Request;

      const result = service.extractRefreshToken(mockReq);

      expect(result).toBe('extracted-token');
    });

    it('should return undefined when cookie not present', () => {
      const mockReq = { cookies: {} } as unknown as Request;

      const result = service.extractRefreshToken(mockReq);

      expect(result).toBeUndefined();
    });

    it('should return undefined when cookies is undefined', () => {
      const mockReq = {} as unknown as Request;

      const result = service.extractRefreshToken(mockReq);

      expect(result).toBeUndefined();
    });
  });
});
