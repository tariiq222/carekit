/**
 * ZatcaController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ZatcaController } from '../../../src/modules/zatca/zatca.controller.js';
import { ZatcaService } from '../../../src/modules/zatca/zatca.service.js';
import { ZatcaSandboxService } from '../../../src/modules/zatca/services/zatca-sandbox.service.js';
import { ZatcaOnboardingService } from '../../../src/modules/zatca/services/zatca-onboarding.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockZatcaService = {
  loadConfig: jest.fn(),
};

const mockSandboxService = {
  getSandboxStats: jest.fn(),
  reportInvoiceToSandbox: jest.fn(),
};

const mockOnboardingService = {
  onboard: jest.fn(),
  getOnboardingStatus: jest.fn(),
};

const mockInvoiceId = 'invoice-uuid-1';

describe('ZatcaController', () => {
  let controller: ZatcaController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZatcaController],
      providers: [
        { provide: ZatcaService, useValue: mockZatcaService },
        { provide: ZatcaSandboxService, useValue: mockSandboxService },
        { provide: ZatcaOnboardingService, useValue: mockOnboardingService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ZatcaController);
  });

  describe('getConfig', () => {
    it('delegates to zatcaService.loadConfig() and returns its result directly', () => {
      const config = { vatNumber: '123456789', phase: 2 };
      mockZatcaService.loadConfig.mockReturnValue(config);

      const result = controller.getConfig();

      expect(mockZatcaService.loadConfig).toHaveBeenCalledTimes(1);
      expect(result).toBe(config);
    });
  });

  describe('onboard', () => {
    it('delegates to onboardingService.onboard(dto.otp) and returns its result directly', () => {
      const promise = Promise.resolve({ status: 'onboarded' });
      mockOnboardingService.onboard.mockReturnValue(promise);

      const result = controller.onboard({ otp: 'TEST-OTP-123' });

      expect(mockOnboardingService.onboard).toHaveBeenCalledWith('TEST-OTP-123');
      expect(result).toBe(promise);
    });
  });

  describe('getOnboardingStatus', () => {
    it('delegates to onboardingService.getOnboardingStatus() and returns its result directly', () => {
      const promise = Promise.resolve({ enrolled: true });
      mockOnboardingService.getOnboardingStatus.mockReturnValue(promise);

      const result = controller.getOnboardingStatus();

      expect(mockOnboardingService.getOnboardingStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(promise);
    });
  });

  describe('getSandboxStats', () => {
    it('delegates to sandboxService.getSandboxStats() and returns its result directly', () => {
      const promise = Promise.resolve({ reported: 5, failed: 0 });
      mockSandboxService.getSandboxStats.mockReturnValue(promise);

      const result = controller.getSandboxStats();

      expect(mockSandboxService.getSandboxStats).toHaveBeenCalledTimes(1);
      expect(result).toBe(promise);
    });
  });

  describe('reportToSandbox', () => {
    it('delegates to sandboxService.reportInvoiceToSandbox(invoiceId) and returns its result directly', () => {
      const promise = Promise.resolve({ clearanceStatus: 'CLEARED' });
      mockSandboxService.reportInvoiceToSandbox.mockReturnValue(promise);

      const result = controller.reportToSandbox(mockInvoiceId);

      expect(mockSandboxService.reportInvoiceToSandbox).toHaveBeenCalledWith(mockInvoiceId);
      expect(result).toBe(promise);
    });
  });
});
