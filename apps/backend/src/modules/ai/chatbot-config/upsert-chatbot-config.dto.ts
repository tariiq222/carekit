import { Allow, IsArray, IsDefined, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConfigItemDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  // Accepts any JSON-serializable value — intentionally permissive
  @IsDefined()
  @Allow()
  value!: unknown;

  @IsString()
  @IsNotEmpty()
  category!: string;
}

export class UpsertChatbotConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  configs!: ConfigItemDto[];
}
