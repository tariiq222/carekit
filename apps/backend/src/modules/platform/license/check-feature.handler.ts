import { Injectable } from '@nestjs/common';
import { ValidateLicenseService } from './validate-license.service';

export interface CheckFeatureQuery {
  tenantId: string;
  feature: string;
}

@Injectable()
export class CheckFeatureHandler {
  constructor(private readonly licenseService: ValidateLicenseService) {}

  async execute(query: CheckFeatureQuery): Promise<boolean> {
    const license = await this.licenseService.getActiveLicense(query.tenantId);
    return license.features.includes(query.feature);
  }
}
