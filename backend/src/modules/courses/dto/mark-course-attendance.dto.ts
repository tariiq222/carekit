import { IsUUID, IsArray, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkCourseAttendanceDto {
  @ApiProperty({ format: 'uuid', description: 'The CourseSession ID being marked' })
  @IsUUID()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Patient enrollment IDs that attended this session',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  attendedPatientIds!: string[];
}
