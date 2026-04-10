import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ description: 'Booking ID the report is about', format: 'uuid' })
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ enum: ProblemReportTypeValue, description: 'Problem category' })
  @IsEnum(ProblemReportTypeValue)
  type!: ProblemReportTypeValue;

  @ApiProperty({ description: 'Detailed description of the problem', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
