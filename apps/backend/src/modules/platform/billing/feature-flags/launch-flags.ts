import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LaunchFlags {
  constructor(private readonly config: ConfigService) {}

  get planVersioningEnabled(): boolean {
    return this.config.get<string>('PLAN_VERSIONING_ENABLED') === 'true';
  }

  get trialAutoChargeEnabled(): boolean {
    return this.config.get<string>('TRIAL_AUTO_CHARGE_ENABLED') === 'true';
  }

  get couponStrictEnabled(): boolean {
    return this.config.get<string>('COUPON_STRICT_ENABLED') === 'true';
  }

  get bookingExpiryEnabled(): boolean {
    return this.config.get<string>('BOOKING_EXPIRY_CRON_ENABLED') === 'true';
  }
}
