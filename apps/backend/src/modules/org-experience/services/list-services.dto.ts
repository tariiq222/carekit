import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListServicesDto extends PaginationDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}
