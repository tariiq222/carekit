import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titleAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titleEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  bodyAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  bodyEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  type!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
