import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPractitionersDto {
  @ApiProperty({ type: [String], description: 'Array of practitioner UUIDs to assign', example: ['uuid1', 'uuid2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  practitionerIds!: string[];
}
