import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListEmployeesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name, email, or phone', example: 'Khalid' })
  @IsOptional() @IsString() search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by gender', enum: EmployeeGender, enumName: 'EmployeeGender', example: EmployeeGender.MALE })
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;

  @ApiPropertyOptional({ description: 'Filter by employment type', enum: EmploymentType, enumName: 'EmploymentType', example: EmploymentType.FULL_TIME })
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: 'Filter by onboarding status', enum: OnboardingStatus, enumName: 'OnboardingStatus', example: OnboardingStatus.COMPLETED })
  @IsOptional() @IsEnum(OnboardingStatus) onboardingStatus?: OnboardingStatus;

  @ApiPropertyOptional({ description: 'Filter by specialty UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() specialtyId?: string;

  @ApiPropertyOptional({ description: 'Filter by branch UUID', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() branchId?: string;
}
