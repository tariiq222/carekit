import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateRecurringBookingDto {
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @IsEnum(['clinic_visit', 'phone_consultation', 'video_consultation'])
  @IsNotEmpty()
  type!: 'clinic_visit' | 'phone_consultation' | 'video_consultation';

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

  @IsEnum(['weekly', 'biweekly'])
  @IsNotEmpty()
  repeatEvery!: 'weekly' | 'biweekly';

  @IsInt()
  @Min(2)
  @Max(52)
  repeatCount!: number;
}
