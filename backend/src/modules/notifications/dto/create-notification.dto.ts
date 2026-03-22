import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  titleAr!: string;

  @IsString()
  @IsNotEmpty()
  titleEn!: string;

  @IsString()
  @IsNotEmpty()
  bodyAr!: string;

  @IsString()
  @IsNotEmpty()
  bodyEn!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
