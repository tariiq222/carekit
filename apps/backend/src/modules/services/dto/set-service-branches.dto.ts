import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SetServiceBranchesDto {
  @ApiProperty({
    type: [String],
    description:
      'Branch IDs to restrict this service to. Send an empty array [] to make the service available at all branches (global).',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds: string[];
}
