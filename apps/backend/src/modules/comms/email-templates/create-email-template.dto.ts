import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Unique slug identifier for the template', example: 'booking-confirmed' })
  @IsString() @MinLength(2) @MaxLength(64) slug!: string;

  @ApiProperty({ description: 'Arabic display name', example: 'تأكيد الحجز' })
  @IsString() @MinLength(1) @MaxLength(200) nameAr!: string;

  @ApiPropertyOptional({ description: 'English display name', example: 'Booking Confirmed' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiProperty({ description: 'Arabic email subject line', example: 'تم تأكيد حجزك' })
  @IsString() @MinLength(1) @MaxLength(300) subjectAr!: string;

  @ApiPropertyOptional({ description: 'English email subject line', example: 'Your booking is confirmed' })
  @IsOptional() @IsString() @MaxLength(300) subjectEn?: string;

  @ApiProperty({ description: 'HTML body of the email (supports Handlebars variables)', example: '<p>Hello {{name}}</p>' })
  @IsString() htmlBody!: string;
}
