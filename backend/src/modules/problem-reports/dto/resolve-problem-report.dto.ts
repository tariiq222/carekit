import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResolveStatusValue {
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class ResolveProblemReportDto {
  @ApiProperty({ enum: ResolveStatusValue, description: 'Resolution outcome' })
  @IsEnum(ResolveStatusValue)
  status!: ResolveStatusValue;

  @ApiPropertyOptional({ description: 'Admin notes about the resolution', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
