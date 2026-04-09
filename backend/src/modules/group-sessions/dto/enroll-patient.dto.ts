import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class EnrollPatientDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;
}
