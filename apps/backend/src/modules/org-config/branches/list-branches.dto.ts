import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListBranchesDto extends PaginationDto {
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
}
