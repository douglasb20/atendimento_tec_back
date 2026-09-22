import { PartialType } from '@nestjs/mapped-types';

import { CreateServiceAlertDto } from './create-service-alert.dto';

export class UpdateServiceAlertDto extends PartialType(CreateServiceAlertDto) {}
