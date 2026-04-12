import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';

export class ListEmployeesDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(OnboardingStatus) onboardingStatus?: OnboardingStatus;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
