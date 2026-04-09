import { PartialType } from '@nestjs/swagger';
import { CreateOfferingDto } from './create-offering.dto.js';

export class UpdateOfferingDto extends PartialType(CreateOfferingDto) {}
