import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListDepartmentsDto extends PaginationDto {
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
