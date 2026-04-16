import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Arabic display name', example: 'تأكيد الحجز' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'English display name', example: 'Booking Confirmed' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Arabic email subject line', example: 'تم تأكيد حجزك' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) subjectAr?: string;

  @ApiPropertyOptional({ description: 'English email subject line', example: 'Your booking is confirmed' })
  @IsOptional() @IsString() @MaxLength(300) subjectEn?: string;

  @ApiPropertyOptional({ description: 'HTML body of the email (supports Handlebars variables)', example: '<p>Hello {{name}}</p>' })
  @IsOptional() @IsString() htmlBody?: string;

  @ApiPropertyOptional({ description: 'Whether the template is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}
