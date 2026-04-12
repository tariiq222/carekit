import { IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListConversationsDto extends PaginationDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
}
