import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EmployeeServiceOptionInputDto {
  @IsUUID() durationOptionId!: string;
  @IsOptional() @IsNumber() @Min(0) priceOverride?: number | null;
  @IsOptional() @IsInt() @Min(1) durationOverride?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetEmployeeServiceOptionsDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => EmployeeServiceOptionInputDto)
  options!: EmployeeServiceOptionInputDto[];
}
