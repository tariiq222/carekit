import { IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ListIntakeFormsDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}
