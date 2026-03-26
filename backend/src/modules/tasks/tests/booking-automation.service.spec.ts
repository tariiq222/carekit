/**
 * BookingAutomationService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingAutomationService } from '../booking-automation.service.js';
import { BookingExpiryService } from '../booking-expiry.service.js';
import { BookingAutocompleteService } from '../booking-autocomplete.service.js';
import { BookingNoShowService } from '../booking-noshow.service.js';
import { BookingCancellationTimeoutService } from '../booking-cancellation-timeout.service.js';

const mockExpiryService = {
  expirePendingBookings: jest.fn().mockResolvedValue(undefined),
};
const mockAutocompleteService = {
  autoCompleteBookings: jest.fn().mockResolvedValue(undefined),
};
const mockNoShowService = {
  autoNoShow: jest.fn().mockResolvedValue(undefined),
};
const mockCancellationTimeoutService = {
  autoExpirePendingCancellations: jest.fn().mockResolvedValue(undefined),
};

describe('BookingAutomationService', () => {
  let service: BookingAutomationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingAutomationService,
        { provide: BookingExpiryService, useValue: mockExpiryService },
        { provide: BookingAutocompleteService, useValue: mockAutocompleteService },
        { provide: BookingNoShowService, useValue: mockNoShowService },
        { provide: BookingCancellationTimeoutService, useValue: mockCancellationTimeoutService },
      ],
    }).compile();

    service = module.get<BookingAutomationService>(BookingAutomationService);
    jest.clearAllMocks();
  });

  it('should delegate expirePendingBookings to expiryService', async () => {
    await service.expirePendingBookings();
    expect(mockExpiryService.expirePendingBookings).toHaveBeenCalled();
  });

  it('should delegate autoCompleteBookings to autocompleteService', async () => {
    await service.autoCompleteBookings();
    expect(mockAutocompleteService.autoCompleteBookings).toHaveBeenCalled();
  });

  it('should delegate autoNoShow to noShowService', async () => {
    await service.autoNoShow();
    expect(mockNoShowService.autoNoShow).toHaveBeenCalled();
  });

  it('should delegate autoExpirePendingCancellations to cancellationTimeoutService', async () => {
    await service.autoExpirePendingCancellations();
    expect(mockCancellationTimeoutService.autoExpirePendingCancellations).toHaveBeenCalled();
  });
});
