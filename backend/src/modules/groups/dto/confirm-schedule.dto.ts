import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ConfirmScheduleDto {
  @ApiProperty({
    description: 'ISO 8601 date string for the scheduled start time',
    example: '2026-05-15T09:00:00.000Z',
  })
  @IsDateString(
    {},
    { message: 'startTime must be a valid ISO 8601 date string' },
  )
  startTime!: string;
}
