import { Allow, IsArray, IsDefined, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ConfigItemDto {
  @ApiProperty({ description: 'Configuration key', example: 'greeting_message' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  // Accepts any JSON-serializable value — intentionally permissive
  @ApiProperty({ description: 'Configuration value (any JSON-serializable type)', example: 'Hello! How can I help you today?' })
  @IsDefined()
  @Allow()
  value!: unknown;

  @ApiProperty({ description: 'Configuration category', example: 'general' })
  @IsString()
  @IsNotEmpty()
  category!: string;
}

export class UpsertChatbotConfigDto {
  @ApiProperty({
    description: 'Array of configuration entries to upsert',
    type: [ConfigItemDto],
    example: [{ key: 'greeting_message', value: 'Hello!', category: 'general' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs!: ConfigItemDto[];
}
