import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientGender, ClientSource } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListClientsDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
}
