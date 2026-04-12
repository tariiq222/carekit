import { IsUUID } from 'class-validator';

export class GetEmailTemplateDto {
  @IsUUID() id!: string;
}
