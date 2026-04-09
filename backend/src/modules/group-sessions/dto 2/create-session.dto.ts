import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  registrationDeadline!: string;
}
