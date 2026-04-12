import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class SendPushDto {
  @IsString() @MinLength(1) token!: string;
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsObject() data?: Record<string, string>;
}
