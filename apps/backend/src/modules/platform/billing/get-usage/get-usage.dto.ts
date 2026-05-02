import { ApiProperty } from '@nestjs/swagger';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

export class UsageRowDto {
  @ApiProperty({ enum: FeatureKey, description: 'The feature key for this quota row' })
  featureKey!: string;

  @ApiProperty({ description: 'Current usage value' })
  current!: number;

  @ApiProperty({ description: 'Plan limit; -1 means unlimited' })
  limit!: number;

  @ApiProperty({ description: '0–100; 0 if limit is unlimited' })
  percentage!: number;

  @ApiProperty({ type: Date, nullable: true, description: 'End of the metering period; null for lifetime counters' })
  periodEnd!: Date | null;
}
