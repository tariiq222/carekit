import { IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';

export class SubmitResponseDto {
  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @IsObject()
  answers!: Record<string, string>;
}
