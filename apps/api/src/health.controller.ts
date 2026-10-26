import { Controller, Get } from '@nestjs/common';
import { Publico } from './auth/decoradores';

@Publico()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
