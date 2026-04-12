import { ArrayUnique, IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { EmployeeGender, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{9,15}$/) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) specialtyIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) serviceIds?: string[];
}
