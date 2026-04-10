import { IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitResponseDto {
  @ApiPropertyOptional({ description: 'Intake form ID (omit to use default form for the booking)' })
  @IsOptional()
  @IsUUID()
  formId?: string;

  @ApiProperty({ description: 'Booking ID this response belongs to' })
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @ApiProperty({ description: 'Field answers keyed by field ID', type: 'object', additionalProperties: { type: 'string' } })
  @IsObject()
  answers!: Record<string, string>;
}
