import { IsArray, IsUUID } from 'class-validator';

export class MarkAttendanceDto {
  @IsArray()
  @IsUUID('all', { each: true })
  attendedPatientIds!: string[];
}
