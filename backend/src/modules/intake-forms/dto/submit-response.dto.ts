import { IsNotEmpty, IsObject, IsString, IsUUID } from 'class-validator';

export class SubmitResponseDto {
  @IsUUID()
  @IsNotEmpty()
  formId!: string;

  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @IsObject()
  answers!: Record<string, string>;
}
