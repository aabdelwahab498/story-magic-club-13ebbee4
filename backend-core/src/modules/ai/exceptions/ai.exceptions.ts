import { HttpException, HttpStatus } from '@nestjs/common';

export class AIProviderException extends HttpException {
  constructor(
    message: string,
    public readonly originalError?: any,
    status: number = HttpStatus.SERVICE_UNAVAILABLE,
  ) {
    const isTransient = status === HttpStatus.SERVICE_UNAVAILABLE;
    super(
      {
        statusCode: status,
        error: isTransient ? 'Service Unavailable' : 'AI Provider Error',
        code: isTransient
          ? 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE'
          : 'AI_PROVIDER_ERROR',
        message: isTransient
          ? 'The story service is temporarily busy. Please try again shortly.'
          : message,
      },
      status,
    );
    this.name = 'AIProviderException';
  }
}


export class AIParseException extends Error {
  constructor(
    message: string,
    public readonly rawContent: string,
  ) {
    super(`AI Parse Error: ${message}`);
    this.name = 'AIParseException';
  }
}

export class AIValidationException extends Error {
  constructor(
    message: string,
    public readonly parsedContent: any,
  ) {
    super(`AI Validation Error: ${message}`);
    this.name = 'AIValidationException';
  }
}
