import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto';

export class ListRatingsDto extends PaginationDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() clientId?: string;
}
