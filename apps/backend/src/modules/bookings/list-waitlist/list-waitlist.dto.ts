import { WaitlistStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListWaitlistDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsEnum(WaitlistStatus) status?: WaitlistStatus;
}
