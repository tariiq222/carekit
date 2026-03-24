import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';

export class ConfigItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key: string;

  @IsNotEmpty()
  value: unknown;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  category: string;
}

export class UpdateChatbotConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs: ConfigItemDto[];
}
