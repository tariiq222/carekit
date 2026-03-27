import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID to send the notification to' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Notification title in Arabic', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titleAr!: string;

  @ApiProperty({ description: 'Notification title in English', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titleEn!: string;

  @ApiProperty({ description: 'Notification body in Arabic', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  bodyAr!: string;

  @ApiProperty({ description: 'Notification body in English', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  bodyEn!: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification type' })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType;

  @ApiPropertyOptional({ description: 'Additional data payload', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
