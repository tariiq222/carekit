import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto.js';

/**
 * startDate is excluded — sessions are auto-generated at create time.
 * Changing startDate in v1 is not supported (would require session regeneration).
 */
export class UpdateCourseDto extends PartialType(
  OmitType(CreateCourseDto, ['startDate'] as const),
) {}
