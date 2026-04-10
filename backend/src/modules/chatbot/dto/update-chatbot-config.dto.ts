import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfigItemDto {
  @ApiProperty({ description: 'Configuration key', maxLength: 255, example: 'greeting_message' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key: string;

  @ApiProperty({ description: 'Configuration value' })
  @IsNotEmpty()
  value: unknown;

  @ApiProperty({ description: 'Configuration category', maxLength: 255, example: 'general' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  category: string;
}

export class UpdateChatbotConfigDto {
  @ApiProperty({ type: [ConfigItemDto], description: 'Array of config items to update' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs: ConfigItemDto[];
}
