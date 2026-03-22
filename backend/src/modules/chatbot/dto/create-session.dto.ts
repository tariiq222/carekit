import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  language?: string;
}
