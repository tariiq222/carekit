import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { GroupPaymentType, GroupSchedulingMode, DeliveryMode } from '@prisma/client';

export class CreateGroupDto {
  @ApiProperty({ description: 'Arabic name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr!: string;

  @ApiProperty({ description: 'English name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn!: string;

  @ApiPropertyOptional({ description: 'Arabic description', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  @ApiPropertyOptional({ description: 'English description', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string;

  @ApiProperty({ description: 'Practitioner UUID' })
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @ApiProperty({ description: 'Minimum participants', minimum: 1 })
  @IsInt()
  @Min(1)
  minParticipants!: number;

  @ApiProperty({ description: 'Maximum participants', minimum: 1 })
  @IsInt()
  @Min(1)
  maxParticipants!: number;

  @ApiProperty({ description: 'Price per person in halalat', minimum: 0 })
  @IsInt()
  @Min(0)
  pricePerPersonHalalat!: number;

  @ApiProperty({ description: 'Duration in minutes', minimum: 1 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiPropertyOptional({ description: 'Payment deadline in hours', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDeadlineHours?: number;

  @ApiProperty({ description: 'Scheduling mode', enum: GroupSchedulingMode })
  @IsEnum(GroupSchedulingMode)
  schedulingMode!: GroupSchedulingMode;

  @ValidateIf((o: CreateGroupDto) => o.schedulingMode === 'fixed_date')
  @ApiPropertyOptional({ description: 'Start time (ISO 8601). Required when schedulingMode=fixed_date' })
  @IsDateString()
  @IsNotEmpty()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End date for the group (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Delivery mode', enum: DeliveryMode, default: 'in_person' })
  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @ApiPropertyOptional({ description: 'Physical location for in-person/hybrid' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({ description: 'Online meeting link for online/hybrid' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  meetingLink?: string;

  @ApiProperty({ description: 'Payment type', enum: GroupPaymentType })
  @IsEnum(GroupPaymentType)
  paymentType!: GroupPaymentType;

  @ValidateIf((o: CreateGroupDto) => o.paymentType === 'DEPOSIT')
  @ApiPropertyOptional({ description: 'Deposit amount in halalat (required when paymentType=DEPOSIT)' })
  @IsInt()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ description: 'Whether the group is published' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Expiry date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
