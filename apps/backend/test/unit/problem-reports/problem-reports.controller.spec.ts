/**
 * ProblemReportsController Unit Tests — delegation only
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ProblemReportsController } from '../../../src/modules/problem-reports/problem-reports.controller.js';
import { ProblemReportsService } from '../../../src/modules/problem-reports/problem-reports.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { uuidPipe } from '../../../src/common/pipes/uuid.pipe.js';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  resolve: jest.fn(),
};

const mockUser = { id: 'user-1', email: 'admin@test.com' };

describe('ProblemReportsController', () => {
  let controller: ProblemReportsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProblemReportsController],
      providers: [{ provide: ProblemReportsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overridePipe(uuidPipe)
      .useValue({ transform: (v: string) => v })
      .compile();

    controller = module.get<ProblemReportsController>(ProblemReportsController);
  });

  describe('create', () => {
    it('delegates to service.create with patientId from user', async () => {
      const dto = {
        bookingId: 'b-1',
        type: 'service_quality',
        description: 'Poor service',
      };
      const report = { id: 'r-1', status: 'open' };
      mockService.create.mockResolvedValue(report);

      const result = await controller.create(dto as any, mockUser);

      expect(mockService.create).toHaveBeenCalledWith({
        bookingId: 'b-1',
        patientId: 'user-1',
        type: 'service_quality',
        description: 'Poor service',
      });
      expect(result).toEqual(report);
    });
  });

  describe('findAll', () => {
    it('delegates with parsed page and perPage to integers', async () => {
      const paginated = {
        items: [],
        meta: { total: 0, page: 2, perPage: 10, totalPages: 0 },
      };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll('2', '10', undefined, undefined);

      expect(mockService.findAll).toHaveBeenCalledWith({
        page: 2,
        perPage: 10,
        status: undefined,
        patientId: undefined,
      });
      expect(result).toEqual(paginated);
    });

    it('delegates with status and patientId filters', async () => {
      mockService.findAll.mockResolvedValue({ items: [], meta: {} });

      await controller.findAll(undefined, undefined, 'resolved', 'patient-5');

      expect(mockService.findAll).toHaveBeenCalledWith({
        page: undefined,
        perPage: undefined,
        status: 'resolved',
        patientId: 'patient-5',
      });
    });

    it('passes undefined for page/perPage when not provided', async () => {
      mockService.findAll.mockResolvedValue({ items: [], meta: {} });

      await controller.findAll(undefined, undefined, undefined, undefined);

      expect(mockService.findAll).toHaveBeenCalledWith({
        page: undefined,
        perPage: undefined,
        status: undefined,
        patientId: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne with id', async () => {
      const report = { id: 'r-1', status: 'open' };
      mockService.findOne.mockResolvedValue(report);

      const result = await controller.findOne('r-1');

      expect(mockService.findOne).toHaveBeenCalledWith('r-1');
      expect(result).toEqual(report);
    });
  });

  describe('resolve', () => {
    it('delegates to service.resolve with id, admin userId, and dto', async () => {
      const dto = { status: 'resolved', adminNotes: 'Issue addressed' };
      const resolved = { id: 'r-1', status: 'resolved' };
      mockService.resolve.mockResolvedValue(resolved);

      const result = await controller.resolve('r-1', dto as any, mockUser);

      expect(mockService.resolve).toHaveBeenCalledWith('r-1', 'user-1', {
        status: 'resolved',
        adminNotes: 'Issue addressed',
      });
      expect(result).toEqual(resolved);
    });

    it('delegates resolve with no adminNotes', async () => {
      const dto = { status: 'dismissed' };
      mockService.resolve.mockResolvedValue({ id: 'r-1', status: 'dismissed' });

      await controller.resolve('r-1', dto as any, mockUser);

      expect(mockService.resolve).toHaveBeenCalledWith('r-1', 'user-1', {
        status: 'dismissed',
        adminNotes: undefined,
      });
    });
  });
});
