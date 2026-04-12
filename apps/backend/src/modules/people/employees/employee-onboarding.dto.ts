import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmployeeGender } from '@prisma/client';

export type OnboardingStep = 'profile' | 'specialties' | 'branches' | 'services' | 'complete';

export class EmployeeOnboardingProfileDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{9,15}$/) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() avatarUrl?: string;
}

export class EmployeeOnboardingDto {
  @IsEnum(['profile', 'specialties', 'branches', 'services', 'complete'])
  step!: OnboardingStep;

  @IsOptional() @ValidateNested() @Type(() => EmployeeOnboardingProfileDto)
  profile?: EmployeeOnboardingProfileDto;

  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) specialtyIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) serviceIds?: string[];
}
