import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddToWaitlistDto {
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsUUID() serviceId!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsDateString() preferredDate?: string;
  @IsOptional() @IsString() notes?: string;
}
