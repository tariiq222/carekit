import { IsOptional, IsNumberString, IsString, IsIn, MaxLength } from 'class-validator';

export class SessionListQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  perPage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  handedOff?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dateTo?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: string;
}
