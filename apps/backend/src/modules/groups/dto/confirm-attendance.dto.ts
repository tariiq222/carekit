import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUUID } from 'class-validator';

export class ConfirmAttendanceDto {
  @ApiProperty({ description: 'Group enrollment UUID' })
  @IsUUID()
  enrollmentId!: string;

  @ApiProperty({ description: 'Whether the patient attended' })
  @IsBoolean()
  attended!: boolean;
}
