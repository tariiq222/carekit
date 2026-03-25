import { Injectable } from '@nestjs/common';
import { BookingExpiryService } from './booking-expiry.service.js';
import { BookingAutocompleteService } from './booking-autocomplete.service.js';
import { BookingNoShowService } from './booking-noshow.service.js';
import { BookingCancellationTimeoutService } from './booking-cancellation-timeout.service.js';

/**
 * Orchestrator — delegates to focused automation services.
 * Each method maps 1-to-1 to a queue job in tasks.processor.ts.
 */
@Injectable()
export class BookingAutomationService {
  constructor(
    private readonly expiryService: BookingExpiryService,
    private readonly autocompleteService: BookingAutocompleteService,
    private readonly noShowService: BookingNoShowService,
    private readonly cancellationTimeoutService: BookingCancellationTimeoutService,
  ) {}

  async expirePendingBookings(): Promise<void> {
    return this.expiryService.expirePendingBookings();
  }

  async autoCompleteBookings(): Promise<void> {
    return this.autocompleteService.autoCompleteBookings();
  }

  async autoNoShow(): Promise<void> {
    return this.noShowService.autoNoShow();
  }

  async autoExpirePendingCancellations(): Promise<void> {
    return this.cancellationTimeoutService.autoExpirePendingCancellations();
  }
}
