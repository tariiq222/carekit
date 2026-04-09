import { IsNotEmpty, IsUUID } from 'class-validator';

export class EnrollPatientDto {
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;
}
