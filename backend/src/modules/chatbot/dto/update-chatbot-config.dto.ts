import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class ConfigItemDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsNotEmpty()
  value: unknown;

  @IsString()
  @IsNotEmpty()
  category: string;
}

export class UpdateChatbotConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs: ConfigItemDto[];
}
