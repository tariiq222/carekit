/**
 * PractitionerOnboardingService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PractitionerOnboardingService } from '../practitioner-onboarding.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { OtpService } from '../../auth/otp.service.js';
import { EmailService } from '../../email/email.service.js';

const mockRole = { id: 'role-uuid-1', slug: 'practitioner' };
const mockUser = { id: 'user-uuid-1', email: 'ali@example.com', firstName: 'Ali', lastName: 'Hassan' };
const mockPractitioner = { id: 'pract-uuid-1', userId: mockUser.id };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTx: any = {
  user: { create: jest.fn().mockResolvedValue(mockUser) },
  practitioner: { create: jest.fn().mockResolvedValue(mockPractitioner) },
  userRole: { create: jest.fn().mockResolvedValue({}) },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: { findUnique: jest.fn() },
  role: { findFirst: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOtpService: any = {
  generateOtp: jest.fn().mockResolvedValue('123456'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEmailService: any = {
  sendPractitionerWelcome: jest.fn().mockResolvedValue(undefined),
};

const onboardDto = {
  email: 'Ali@Example.com',
  nameEn: 'Ali Hassan',
  nameAr: 'علي حسن',
  specialty: 'Dermatology',
  specialtyAr: 'الجلدية',
};

describe('PractitionerOnboardingService', () => {
  let service: PractitionerOnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerOnboardingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OtpService, useValue: mockOtpService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PractitionerOnboardingService>(PractitionerOnboardingService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  describe('onboard', () => {
    it('should onboard a new practitioner successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue(mockUser);
      mockTx.practitioner.create.mockResolvedValue(mockPractitioner);
      mockTx.userRole.create.mockResolvedValue({});

      const result = await service.onboard(onboardDto);

      expect(result.success).toBe(true);
      expect(result.practitioner).toBeDefined();
      expect(mockEmailService.sendPractitionerWelcome).toHaveBeenCalledWith(
        'ali@example.com',
        'Ali',
        '123456',
      );
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue(mockUser);
      mockTx.practitioner.create.mockResolvedValue(mockPractitioner);
      mockTx.userRole.create.mockResolvedValue({});

      await service.onboard(onboardDto);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'ali@example.com' },
      });
      expect(mockTx.user.create.mock.calls[0][0].data.email).toBe('ali@example.com');
    });

    it('should split nameEn into firstName and lastName', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue(mockUser);
      mockTx.practitioner.create.mockResolvedValue(mockPractitioner);
      mockTx.userRole.create.mockResolvedValue({});

      await service.onboard(onboardDto);

      const userData = mockTx.user.create.mock.calls[0][0].data;
      expect(userData.firstName).toBe('Ali');
      expect(userData.lastName).toBe('Hassan');
    });

    it('should use full nameEn as firstName when single word', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue({ ...mockUser, firstName: 'Ali', lastName: '' });
      mockTx.practitioner.create.mockResolvedValue(mockPractitioner);
      mockTx.userRole.create.mockResolvedValue({});

      await service.onboard({ ...onboardDto, nameEn: 'Ali' });

      const userData = mockTx.user.create.mock.calls[0][0].data;
      expect(userData.firstName).toBe('Ali');
      expect(userData.lastName).toBe('');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.onboard(onboardDto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if practitioner role not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(null);

      await expect(service.onboard(onboardDto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should generate OTP and send welcome email after transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue(mockUser);
      mockTx.practitioner.create.mockResolvedValue(mockPractitioner);
      mockTx.userRole.create.mockResolvedValue({});

      await service.onboard(onboardDto);

      expect(mockOtpService.generateOtp).toHaveBeenCalledWith(mockUser.id, 'reset_password');
      expect(mockEmailService.sendPractitionerWelcome).toHaveBeenCalled();
    });
  });
});
