import { PartialType } from '@nestjs/mapped-types';

import { CreateTagDto } from './create-tag.dto';

/** Todos os campos são opcionais; o que não vier fica como está. */
export class UpdateTagDto extends PartialType(CreateTagDto) {}
