import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export enum ProblemReportTypeValue {
  WAIT_TIME = 'wait_time',
  STAFF_BEHAVIOR = 'staff_behavior',
  CLEANLINESS = 'cleanliness',
  BILLING = 'billing',
  NO_CALL = 'no_call',
  LATE = 'late',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

export class CreateProblemReportDto {
  @IsUUID()
  bookingId!: string;

  @IsEnum(ProblemReportTypeValue)
  type!: ProblemReportTypeValue;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
