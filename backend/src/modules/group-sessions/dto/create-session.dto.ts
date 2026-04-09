import { IsDateString, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  registrationDeadline!: string;
}
