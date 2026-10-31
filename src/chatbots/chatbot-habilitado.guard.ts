import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceSettingsService } from '@/attendance-settings/attendance-settings.service';

@Injectable()
export class ChatbotHabilitadoGuard implements CanActivate {
  constructor(private readonly ajustes: AttendanceSettingsService) {}

  async canActivate(): Promise<boolean> {
    if (!await this.ajustes.chatbotHabilitado()) {
      throw new ForbiddenException('O módulo Chatbot está desabilitado nas configurações do sistema');
    }
    return true;
  }
}
