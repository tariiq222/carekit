import { IsOptional, IsString } from 'class-validator';

export class CancelRejectDto {
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
