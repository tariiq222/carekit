import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class AssignPermissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  module!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  action!: string;
}
