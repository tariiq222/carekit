import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class BulkAttendanceDto {
  @ApiProperty({ description: 'Array of patient UUIDs who attended', type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  attendedPatientIds!: string[];
}
