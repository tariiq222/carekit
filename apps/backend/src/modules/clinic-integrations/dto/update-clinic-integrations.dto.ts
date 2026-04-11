import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClinicIntegrationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  moyasarPublishableKey?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  moyasarSecretKey?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(34)
  bankIban?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankAccountHolder?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  zoomClientId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  zoomClientSecret?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  zoomAccountId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emailProvider?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailApiKey?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  openrouterApiKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() firebaseConfig?: Record<
    string,
    unknown
  >;
  @ApiPropertyOptional() @IsOptional() @IsString() zatcaPhase?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zatcaCsid?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zatcaSecret?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zatcaPrivateKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zatcaRequestId?: string;
}
