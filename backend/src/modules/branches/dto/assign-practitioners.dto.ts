import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AssignPractitionersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  practitionerIds!: string[];
}
