import { IsEmail, IsEnum, IsOptional, IsString, IsArray, ArrayUnique } from 'class-validator';
import { EmployeeGender, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString() tenantId!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) specialtyIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) serviceIds?: string[];
}
