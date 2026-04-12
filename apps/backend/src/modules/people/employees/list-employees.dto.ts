import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListEmployeesDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(OnboardingStatus) onboardingStatus?: OnboardingStatus;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUUID() branchId?: string;
}
