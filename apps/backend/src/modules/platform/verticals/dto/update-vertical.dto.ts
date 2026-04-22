import { PartialType } from '@nestjs/swagger';
import { CreateVerticalDto } from './create-vertical.dto';

export class UpdateVerticalDto extends PartialType(CreateVerticalDto) {}
