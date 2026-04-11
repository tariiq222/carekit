import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PreferredTime } from '@prisma/client';

export class JoinWaitlistDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD or omit for "any date"' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  preferredDate?: string;

  @ApiPropertyOptional({ enum: PreferredTime })
  @IsOptional()
  @IsEnum(PreferredTime)
  preferredTime?: PreferredTime;
}
