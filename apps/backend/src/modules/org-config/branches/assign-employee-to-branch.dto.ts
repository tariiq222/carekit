import { IsUUID } from 'class-validator';

export class AssignEmployeeToBranchDto {
  @IsUUID() employeeId!: string;
}
