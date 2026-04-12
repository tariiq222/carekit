import { IsNotEmpty, IsString } from 'class-validator';

export class SendStaffMessageDto {
  @IsString()
  @IsNotEmpty()
  body!: string;
}
