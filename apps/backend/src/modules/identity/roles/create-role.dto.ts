import { IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString() tenantId!: string;
  @IsString() @MinLength(2) name!: string;
}
