import { IsOptional, IsString, IsUUID } from 'class-validator';

export class MarkReadDto {
  @IsString() recipientId!: string;
  @IsOptional() @IsUUID() notificationId?: string;
}
