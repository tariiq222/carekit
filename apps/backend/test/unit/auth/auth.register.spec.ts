/**
 * AuthService — Registration Tests
 * Covers: register, validateUser
 */
import { ForbiddenException } from '@nestjs/common';
import { createAuthTestModule, AuthTestContext } from './auth.test-module.js';
import { mockPatientRole, mockCreatedUser } from './auth.fixtures.js';

const registerDto = {
  email: 'newuser@example.com',
  password: 'Str0ngP@ss!',
  firstName: 'أحمد',
  lastName: 'الراشد',
  phone: '+966501234567',
  gender: 'male' as const,
};

describe('AuthService — register', () => {
  let ctx: AuthTestContext;

  function setupRegisterMocks(email = registerDto.email) {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(null);
    ctx.mockPrisma.role.findFirst.mockResolvedValue(mockPatientRole);
    ctx.mockPrisma.user.create.mockResolvedValue(
      mockCreatedUser(email, registerDto.firstName, registerDto.lastName),
    );
    ctx.mockPrisma.userRole.create.mockResolvedValue({});
    ctx.mockPrisma.refreshToken.create.mockResolvedValue({
      token: 'refresh-token',
    });
  }

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should hash password (bcrypt) and never store plaintext', async () => {
    setupRegisterMocks();

    await ctx.service.register(registerDto);

    const createCall = ctx.mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).toBeDefined();
    expect(createCall.data.passwordHash).not.toBe(registerDto.password);
    expect(createCall.data.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(createCall.data).not.toHaveProperty('password');
  });

  it('should assign patient role to new user', async () => {
    setupRegisterMocks();

    await ctx.service.register(registerDto);

    expect(ctx.mockPrisma.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'patient' }),
      }),
    );
    expect(ctx.mockPrisma.userRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: 'patient-role-id' }),
      }),
    );
  });

  it('should return access and refresh tokens with correct expiresIn', async () => {
    setupRegisterMocks();

    const result = await ctx.service.register(registerDto);

    expect(result.accessToken).toBeDefined();
    expect(typeof result.accessToken).toBe('string');
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(900);
  });

  it('should send welcome email after registration', async () => {
    setupRegisterMocks();

    await ctx.service.register(registerDto);

    expect(ctx.mockEmail.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: registerDto.email }),
    );
  });

  it('should normalize email to lowercase', async () => {
    setupRegisterMocks('upper@example.com');

    await ctx.service.register({ ...registerDto, email: 'UPPER@EXAMPLE.COM' });

    const createCall = ctx.mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.email).toBe('upper@example.com');
  });

  it('should throw if email already exists', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-id',
      email: registerDto.email,
    });

    await expect(ctx.service.register(registerDto)).rejects.toThrow();
  });

  it('should return 409 ConflictException when DB throws P2002 on concurrent registration', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(null);
    ctx.mockPrisma.role.findFirst.mockResolvedValue(null);

    const p2002Error = new Error(
      'Unique constraint failed on the fields: (`email`)',
    ) as Error & { code: string };
    p2002Error.code = 'P2002';
    Object.defineProperty(p2002Error, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
      writable: true,
    });

    ctx.mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);

    await expect(
      ctx.service.register({
        email: 'race@example.com',
        password: 'Password1!',
        firstName: 'Test',
        lastName: 'User',
      }),
    ).rejects.toMatchObject({
      response: { error: 'USER_EMAIL_EXISTS', statusCode: 409 },
    });
  });
});

describe('AuthService — validateUser', () => {
  let ctx: AuthTestContext;

  beforeEach(async () => {
    ctx = await createAuthTestModule();
    jest.clearAllMocks();
  });

  it('should return user for valid credentials', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash:
        '$2b$10$9j3H5FgD2RehMd.kiLvD5e9OgKUXdn3Muco883p5BENhEsEDQAl2C',
      firstName: 'أحمد',
      lastName: 'الراشد',
      isActive: true,
      emailVerified: true,
      userRoles: [{ role: { slug: 'patient' } }],
    });

    const result = await ctx.service.validateUser(
      'user@example.com',
      'correctpassword',
    );

    expect(result).not.toBeNull();
    expect(result!.email).toBe('user@example.com');
  });

  it('should return null for invalid password', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: '$2b$10$somehashedpassword',
      isActive: true,
    });

    const result = await ctx.service.validateUser(
      'user@example.com',
      'wrongpassword',
    );

    expect(result).toBeNull();
  });

  it('should return null for non-existent email', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await ctx.service.validateUser(
      'nobody@example.com',
      'anypassword',
    );

    expect(result).toBeNull();
  });

  it('should throw ForbiddenException for deactivated user', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'deactivated@example.com',
      passwordHash: '$2b$10$somehashedpassword',
      isActive: false,
    });

    await expect(
      ctx.service.validateUser('deactivated@example.com', 'anypassword'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should normalize email to lowercase for lookup', async () => {
    ctx.mockPrisma.user.findUnique.mockResolvedValue(null);

    await ctx.service.validateUser('USER@EXAMPLE.COM', 'password');

    const findCall = ctx.mockPrisma.user.findUnique.mock.calls[0][0];
    expect(findCall.where.email).toBe('user@example.com');
  });
});
