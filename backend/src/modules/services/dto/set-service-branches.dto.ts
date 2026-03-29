import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class SetServiceBranchesDto {
  @ApiProperty({ type: [String], description: 'Branch IDs to restrict this service to' })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  branchIds: string[];
}
