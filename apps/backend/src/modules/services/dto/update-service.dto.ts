import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto.js';

/**
 * UpdateServiceDto — all fields from CreateServiceDto become optional.
 * practitionerIds and branchIds are omitted — managed via dedicated endpoints:
 *   PUT /services/:id/practitioners
 *   PUT /services/:id/branches
 */
export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['practitionerIds', 'branchIds'] as const),
) {}
