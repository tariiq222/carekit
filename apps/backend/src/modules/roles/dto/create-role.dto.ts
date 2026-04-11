import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ description: 'Role display name', maxLength: 255, example: 'Receptionist' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'URL-safe slug. Auto-generated from name if omitted.', maxLength: 255, example: 'receptionist' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ description: 'Role description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class AssignPermissionDto {
  @ApiProperty({ description: 'Module name this permission applies to', maxLength: 255, example: 'bookings' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  module!: string;

  @ApiProperty({ description: 'Action within the module', maxLength: 255, example: 'read' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  action!: string;
}
