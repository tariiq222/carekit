/**
 * RatingsController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { RatingsController } from '../../../src/modules/ratings/ratings.controller.js';
import { RatingsService } from '../../../src/modules/ratings/ratings.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';

const mockRatingsService = {
  create: jest.fn(),
  findByPractitioner: jest.fn(),
  findByBooking: jest.fn(),
};
const mockUser = { id: 'user-1' };

describe('RatingsController', () => {
  let controller: RatingsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatingsController],
      providers: [{ provide: RatingsService, useValue: mockRatingsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(RatingsController);
  });

  it('create → ratingsService.create()', () => {
    mockRatingsService.create.mockResolvedValue({ id: '1' });
    controller.create(mockUser as any, { bookingId: 'b-1', stars: 5 } as any);
    expect(mockRatingsService.create).toHaveBeenCalled();
  });

  it('findByPractitioner → ratingsService.findByPractitioner()', () => {
    mockRatingsService.findByPractitioner.mockResolvedValue([]);
    controller.findByPractitioner('prac-1', undefined, undefined);
    expect(mockRatingsService.findByPractitioner).toHaveBeenCalledWith(
      'prac-1',
      expect.any(Object),
    );
  });

  it('findByBooking → ratingsService.findByBooking()', () => {
    mockRatingsService.findByBooking.mockResolvedValue(null);
    controller.findByBooking('booking-1');
    expect(mockRatingsService.findByBooking).toHaveBeenCalledWith('booking-1');
  });
});
