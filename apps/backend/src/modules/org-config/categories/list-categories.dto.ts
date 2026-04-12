import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListCategoriesDto extends PaginationDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
}
