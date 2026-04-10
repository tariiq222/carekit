import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class EnrollGroupDto {
  @ApiProperty({ description: 'Patient UUID to enroll' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;
}
