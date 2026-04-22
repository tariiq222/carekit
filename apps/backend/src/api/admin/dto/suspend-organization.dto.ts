import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class SuspendOrganizationDto {
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10, { message: 'reason must be at least 10 characters' })
  @MaxLength(1000)
  reason!: string;
}

export class ReinstateOrganizationDto {
  @ApiProperty({ required: false, minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason?: string;
}
