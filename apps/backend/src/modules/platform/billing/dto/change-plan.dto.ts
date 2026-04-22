import { IsEnum, IsUUID } from 'class-validator';
import { BillingCycle } from '@prisma/client';

export class ChangePlanDto {
  @IsUUID() planId!: string;
  @IsEnum(BillingCycle) billingCycle!: BillingCycle;
}
