import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatCompletionDto {
  @IsString() @MinLength(1) @MaxLength(4000) userMessage!: string;
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() userId?: string;
}

export interface ChatCompletionResult {
  sessionId: string;
  reply: string;
  sourcesUsed: number;
}
