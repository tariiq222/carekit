import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @IsEnum(['clinic_visit', 'phone_consultation', 'video_consultation', 'walk_in'])
  @IsNotEmpty()
  type!: 'clinic_visit' | 'phone_consultation' | 'video_consultation' | 'walk_in';

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Fix 7: Admin can book on behalf of a patient */
  @IsOptional()
  @IsUUID()
  patientId?: string;
}
