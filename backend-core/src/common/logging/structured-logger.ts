import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';
import { RequestContext } from '../middleware/request-context.js';

@Injectable()
export class StructuredLogger extends ConsoleLogger implements LoggerService {
  constructor(context?: string) {
    super(context || 'App');
  }

  log(message: any, context?: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('log', message, context);
    } else {
      super.log(message, context);
    }
  }

  error(message: any, stack?: string, context?: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('error', message, context, stack);
    } else {
      super.error(message, stack, context);
    }
  }

  warn(message: any, context?: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('warn', message, context);
    } else {
      super.warn(message, context);
    }
  }

  debug(message: any, context?: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('debug', message, context);
    } else {
      super.debug(message, context);
    }
  }

  verbose(message: any, context?: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('verbose', message, context);
    } else {
      super.verbose(message, context);
    }
  }

  private printJson(level: string, message: any, contextOverride?: string, stack?: string): void {
    const context = contextOverride || this.context || 'App';
    const store = RequestContext.getStore();
    const isProd = process.env.NODE_ENV === 'production';

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      context,
      message: typeof message === 'object' ? message : String(message),
      request_id: store?.requestId,
      trace_id: store?.traceId,
      user_id: store?.userId,
      service: 'najmah-backend-core',
      stack: stack && !isProd ? stack : undefined,
    };

    console.log(JSON.stringify(logEntry));
  }
}
