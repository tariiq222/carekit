import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ClientGender, ClientSource } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
};

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class ListClientsDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Transform(toBoolean, { toClassOnly: true }) @IsBoolean() isActive?: boolean;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientSource) source?: ClientSource;
}
