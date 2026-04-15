import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListEmployeesDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(OnboardingStatus) onboardingStatus?: OnboardingStatus;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUUID() branchId?: string;
}
