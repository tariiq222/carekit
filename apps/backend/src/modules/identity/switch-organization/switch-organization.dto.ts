import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchOrganizationDto {
  @ApiProperty({
    description: 'Target organization the caller wants to switch context to.',
    example: '00000000-0000-0000-0000-000000000002',
    format: 'uuid',
  })
  @IsUUID()
  organizationId!: string;
}
