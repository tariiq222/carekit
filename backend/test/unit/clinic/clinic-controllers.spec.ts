import { Test, TestingModule } from '@nestjs/testing';
import { ClinicHolidaysController } from '../../../src/modules/clinic/clinic-holidays.controller.js';
import { ClinicHoursController } from '../../../src/modules/clinic/clinic-hours.controller.js';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';
import { ClinicHoursService } from '../../../src/modules/clinic/clinic-hours.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockHolidays = { findAll: jest.fn(), create: jest.fn(), delete: jest.fn() };
const mockHours = { getAll: jest.fn(), setHours: jest.fn() };

const guardOverrides = (builder: any) =>
  builder
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true });

describe('ClinicHolidaysController', () => {
  let controller: ClinicHolidaysController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await guardOverrides(
      Test.createTestingModule({
        controllers: [ClinicHolidaysController],
        providers: [{ provide: ClinicHolidaysService, useValue: mockHolidays }],
      }),
    ).compile();
    controller = module.get<ClinicHolidaysController>(ClinicHolidaysController);
  });

  describe('findAll', () => {
    it('should parse year and wrap in success envelope', async () => {
      const holidays = [{ id: 'h1', date: '2026-01-01' }];
      mockHolidays.findAll.mockResolvedValue(holidays);
      expect(await controller.findAll('2026')).toEqual({ success: true, data: holidays });
      expect(mockHolidays.findAll).toHaveBeenCalledWith(2026);
    });

    it('should pass undefined when year not provided', async () => {
      mockHolidays.findAll.mockResolvedValue([]);
      await controller.findAll(undefined);
      expect(mockHolidays.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('create', () => {
    it('should delegate with dto', async () => {
      const dto = { date: '2026-09-23', nameAr: 'اليوم الوطني' } as any;
      const created = { id: 'h2', ...dto };
      mockHolidays.create.mockResolvedValue(created);
      expect(await controller.create(dto)).toEqual({ success: true, data: created });
      expect(mockHolidays.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('remove', () => {
    it('should delegate and return null data', async () => {
      mockHolidays.delete.mockResolvedValue(undefined);
      expect(await controller.remove('h1')).toEqual({ success: true, data: null });
      expect(mockHolidays.delete).toHaveBeenCalledWith('h1');
    });
  });
});

describe('ClinicHoursController', () => {
  let controller: ClinicHoursController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await guardOverrides(
      Test.createTestingModule({
        controllers: [ClinicHoursController],
        providers: [{ provide: ClinicHoursService, useValue: mockHours }],
      }),
    ).compile();
    controller = module.get<ClinicHoursController>(ClinicHoursController);
  });

  describe('getAll', () => {
    it('should wrap result in success envelope', async () => {
      const hours = [{ day: 0, open: '08:00', close: '16:00' }];
      mockHours.getAll.mockResolvedValue(hours);
      expect(await controller.getAll()).toEqual({ success: true, data: hours });
    });
  });

  describe('setHours', () => {
    it('should delegate with dto', async () => {
      const dto = { hours: [{ day: 0, open: '09:00', close: '17:00' }] } as any;
      const result = [{ day: 0, open: '09:00', close: '17:00' }];
      mockHours.setHours.mockResolvedValue(result);
      expect(await controller.setHours(dto)).toEqual({ success: true, data: result });
      expect(mockHours.setHours).toHaveBeenCalledWith(dto);
    });
  });
});

