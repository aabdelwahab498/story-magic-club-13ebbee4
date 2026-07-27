import { Injectable } from '@nestjs/common';

/**
 * Root application service.
 * Returns a minimal API identification payload at the root route.
 */
@Injectable()
export class AppService {
  getApiInfo(): { name: string; status: string } {
    return { name: 'Najmah Backend Core', status: 'operational' };
  }
}
