import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ResolveStatusValue {
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class ResolveProblemReportDto {
  @IsEnum(ResolveStatusValue)
  status!: ResolveStatusValue;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
