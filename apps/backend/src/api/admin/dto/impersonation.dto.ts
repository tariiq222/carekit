import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartImpersonationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetUserId!: string;
}
