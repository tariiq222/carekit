import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BillingCycle } from '@prisma/client';

export class StartSubscriptionDto {
  @IsUUID() planId!: string;
  @IsEnum(BillingCycle) billingCycle!: BillingCycle;
  @IsOptional() @IsString() moyasarCardTokenRef?: string;
}
