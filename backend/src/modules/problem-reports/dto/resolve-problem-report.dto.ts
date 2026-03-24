import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ResolveStatusValue {
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class ResolveProblemReportDto {
  @IsEnum(ResolveStatusValue)
  status!: ResolveStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
