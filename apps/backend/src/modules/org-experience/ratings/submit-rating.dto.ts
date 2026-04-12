import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class SubmitRatingDto {
  @IsUUID() bookingId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsInt() @Min(1) @Max(5) score!: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
}
