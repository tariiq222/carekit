import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertTerminologyOverrideDto {
  @ApiProperty({ description: 'قيمة المصطلح بالعربية', example: 'مريض' })
  @IsString()
  valueAr!: string;

  @ApiProperty({ description: 'Term value in English', example: 'Patient' })
  @IsString()
  valueEn!: string;
}
