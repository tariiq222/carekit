import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

export type OverrideMode = 'INHERIT' | 'FORCE_ON' | 'FORCE_OFF';

export class UpsertFeatureFlagOverrideDto {
  @ApiProperty({ format: 'uuid', description: 'Organization to override for' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ description: 'Feature key from FeatureKey enum', example: 'coupons' })
  @IsEnum(Object.values(FeatureKey))
  key!: string;

  @ApiProperty({
    enum: ['INHERIT', 'FORCE_ON', 'FORCE_OFF'],
    description: 'INHERIT removes the override; FORCE_ON/FORCE_OFF pin the value',
  })
  @IsEnum(['INHERIT', 'FORCE_ON', 'FORCE_OFF'])
  mode!: OverrideMode;

  @ApiProperty({ minLength: 10, maxLength: 500, description: 'Reason for the override (audit trail)' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
