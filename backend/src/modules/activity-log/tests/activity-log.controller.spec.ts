/** CareKit — ActivityLogController Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogController } from '../activity-log.controller.js';
import { ActivityLogService } from '../activity-log.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
};

describe('ActivityLogController', () => {
  let controller: ActivityLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityLogController],
      providers: [{ provide: ActivityLogService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ActivityLogController>(ActivityLogController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with query params', () => {
      const logs = [{ id: 'log-1' }];
      mockService.findAll.mockReturnValue(logs);

      const query = { page: 1, perPage: 20, module: 'bookings' };
      const result = controller.findAll(query as never);

      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'bookings' }),
      );
      expect(result).toEqual(logs);
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne with id', () => {
      const log = { id: 'log-uuid-1' };
      mockService.findOne.mockReturnValue(log);

      const result = controller.findOne('log-uuid-1');

      expect(mockService.findOne).toHaveBeenCalledWith('log-uuid-1');
      expect(result).toEqual(log);
    });
  });
});
