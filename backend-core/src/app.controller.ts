import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

/**
 * Root controller.
 * Handles the GET / route as a public API identification endpoint.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getApiInfo(): { name: string; status: string } {
    return this.appService.getApiInfo();
  }
}
