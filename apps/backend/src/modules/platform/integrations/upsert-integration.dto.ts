import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertIntegrationDto {
  @IsString() provider!: string;
  @IsObject() config!: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
