import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

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
  @MaxLength(255)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Fix 7: Admin can book on behalf of a patient */
  @IsOptional()
  @IsUUID()
  patientId?: string;
}
