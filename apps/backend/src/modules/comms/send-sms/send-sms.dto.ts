import { IsString, MinLength } from 'class-validator';

export class SendSmsDto {
  @IsString() @MinLength(5) phone!: string;
  @IsString() @MinLength(1) body!: string;
}
