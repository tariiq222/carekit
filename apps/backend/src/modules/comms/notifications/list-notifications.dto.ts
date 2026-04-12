import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListNotificationsDto extends PaginationDto {
  @IsString() recipientId!: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) unreadOnly?: boolean;
}
