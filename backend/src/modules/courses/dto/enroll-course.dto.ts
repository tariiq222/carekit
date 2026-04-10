import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollCourseDto {
  @ApiProperty({ format: 'uuid', description: 'Patient user ID to enroll' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;
}
