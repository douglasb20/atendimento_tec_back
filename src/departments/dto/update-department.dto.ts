import { PartialType } from '@nestjs/mapped-types';

import { CreateDepartmentDto } from './create-department.dto';

/** Todos os campos são opcionais; o que não vier fica como está. */
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}
