import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFeatureFlagDto {
  @ApiProperty({ description: 'Set to true to enable the flag, false to disable it', example: true })
  @IsBoolean() enabled!: boolean;
}
