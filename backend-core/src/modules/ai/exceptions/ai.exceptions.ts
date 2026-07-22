export class AIProviderException extends Error {
  constructor(
    message: string,
    public readonly originalError?: any,
  ) {
    super(`AI Provider Error: ${message}`);
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
