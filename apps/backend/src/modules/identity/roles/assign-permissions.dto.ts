import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PermissionEntryDto {
  @IsString() action!: string;
  @IsString() subject!: string;
}

export class AssignPermissionsDto {
  @IsString() tenantId!: string;
  @IsString() customRoleId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PermissionEntryDto) permissions!: PermissionEntryDto[];
}
