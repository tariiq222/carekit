import { IsEmail, IsObject, IsString, MinLength } from 'class-validator';

export class SendEmailDto {
  @IsEmail() to!: string;
  @IsString() @MinLength(1) templateSlug!: string;
  @IsObject() vars!: Record<string, string>;
}
