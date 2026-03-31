import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBookingFlowOrderDto {
  @ApiProperty({ enum: ['service_first', 'practitioner_first'] })
  @IsIn(['service_first', 'practitioner_first'])
  order: 'service_first' | 'practitioner_first';
}
