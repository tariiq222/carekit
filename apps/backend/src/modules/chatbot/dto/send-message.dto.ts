import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content to send to the chatbot', maxLength: 2000, example: 'What are your clinic hours?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
