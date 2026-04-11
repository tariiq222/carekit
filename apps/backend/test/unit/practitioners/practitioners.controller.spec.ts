/**
 * PractitionersController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PractitionersController } from '../../../src/modules/practitioners/practitioners.controller.js';
import { PractitionersService } from '../../../src/modules/practitioners/practitioners.service.js';
import { PractitionerOnboardingService } from '../../../src/modules/practitioners/practitioner-onboarding.service.js';
import { PractitionerAvailabilityService } from '../../../src/modules/practitioners/practitioner-availability.service.js';
import { PractitionerVacationService } from '../../../src/modules/practitioners/practitioner-vacation.service.js';
import { PractitionerBreaksService } from '../../../src/modules/practitioners/practitioner-breaks.service.js';
import { PractitionerServiceService } from '../../../src/modules/practitioners/practitioner-service.service.js';
import { PractitionerRatingsService } from '../../../src/modules/practitioners/practitioner-ratings.service.js';

const mockPractitionersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockOnboardingService = { onboard: jest.fn() };
const mockAvailabilityService = {
  getAvailability: jest.fn(),
  setAvailability: jest.fn(),
  getSlots: jest.fn(),
};
const mockVacationService = {
  getVacations: jest.fn(),
  createVacation: jest.fn(),
  deleteVacation: jest.fn(),
};
const mockBreaksService = { getBreaks: jest.fn(), setBreaks: jest.fn() };
const mockServiceService = {
  listServices: jest.fn(),
  assignService: jest.fn(),
  updateService: jest.fn(),
  removeService: jest.fn(),
  getServiceTypes: jest.fn(),
};
const mockRatingsService = { getRatings: jest.fn() };

describe('PractitionersController', () => {
  let controller: PractitionersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PractitionersController],
      providers: [
        { provide: PractitionersService, useValue: mockPractitionersService },
        {
          provide: PractitionerOnboardingService,
          useValue: mockOnboardingService,
        },
        {
          provide: PractitionerAvailabilityService,
          useValue: mockAvailabilityService,
        },
        { provide: PractitionerVacationService, useValue: mockVacationService },
        { provide: PractitionerBreaksService, useValue: mockBreaksService },
        { provide: PractitionerServiceService, useValue: mockServiceService },
        { provide: PractitionerRatingsService, useValue: mockRatingsService },
      ],
    }).compile();
    controller = module.get(PractitionersController);
  });

  it('findAll → practitionersService.findAll()', async () => {
    mockPractitionersService.findAll.mockResolvedValue([]);
    await controller.findAll({} as any);
    expect(mockPractitionersService.findAll).toHaveBeenCalled();
  });

  it('findOne → practitionersService.findOne()', async () => {
    mockPractitionersService.findOne.mockResolvedValue({ id: '1' });
    await controller.findOne('id-1');
    expect(mockPractitionersService.findOne).toHaveBeenCalledWith('id-1');
  });

  it('create → practitionersService.create()', async () => {
    mockPractitionersService.create.mockResolvedValue({ id: '1' });
    await controller.create({} as any);
    expect(mockPractitionersService.create).toHaveBeenCalled();
  });

  it('onboard → onboardingService.onboard()', async () => {
    mockOnboardingService.onboard.mockResolvedValue({ id: '1' });
    await controller.onboard({} as any);
    expect(mockOnboardingService.onboard).toHaveBeenCalled();
  });

  it('update → practitionersService.update()', async () => {
    mockPractitionersService.update.mockResolvedValue({ id: '1' });
    await controller.update('id-1', {} as any, { id: 'user-1' } as any);
    expect(mockPractitionersService.update).toHaveBeenCalled();
  });

  it('delete → practitionersService.delete()', async () => {
    mockPractitionersService.delete.mockResolvedValue(undefined);
    await controller.delete('id-1');
    expect(mockPractitionersService.delete).toHaveBeenCalledWith('id-1');
  });

  it('getAvailability → availabilityService.getAvailability()', async () => {
    mockAvailabilityService.getAvailability.mockResolvedValue([]);
    await controller.getAvailability('id-1');
    expect(mockAvailabilityService.getAvailability).toHaveBeenCalledWith(
      'id-1',
    );
  });

  it('setAvailability → availabilityService.setAvailability()', async () => {
    mockAvailabilityService.setAvailability.mockResolvedValue([]);
    await controller.setAvailability(
      'id-1',
      {} as any,
      { id: 'user-1' } as any,
    );
    expect(mockAvailabilityService.setAvailability).toHaveBeenCalled();
  });

  it('getSlots → availabilityService.getSlots()', async () => {
    mockAvailabilityService.getSlots.mockResolvedValue([]);
    await controller.getSlots('id-1', {} as any);
    expect(mockAvailabilityService.getSlots).toHaveBeenCalled();
  });

  it('getBreaks → breaksService.getBreaks()', async () => {
    mockBreaksService.getBreaks.mockResolvedValue([]);
    await controller.getBreaks('id-1');
    expect(mockBreaksService.getBreaks).toHaveBeenCalledWith('id-1');
  });

  it('getVacations → vacationService.getVacations()', async () => {
    mockVacationService.getVacations.mockResolvedValue([]);
    await controller.getVacations('id-1');
    expect(mockVacationService.getVacations).toHaveBeenCalledWith('id-1');
  });

  it('listServices → serviceService.listServices()', async () => {
    mockServiceService.listServices.mockResolvedValue([]);
    await controller.listServices('id-1');
    expect(mockServiceService.listServices).toHaveBeenCalledWith('id-1');
  });

  it('getRatings → ratingsService.getRatings()', async () => {
    mockRatingsService.getRatings.mockResolvedValue([]);
    await controller.getRatings('id-1', {} as any);
    expect(mockRatingsService.getRatings).toHaveBeenCalled();
  });
});
