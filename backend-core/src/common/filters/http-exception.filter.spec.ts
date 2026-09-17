import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { AIProviderUnavailableException } from '../../modules/ai/exceptions/ai.exceptions.js';

function makeHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter — AI provider error contract', () => {
  const filter = new HttpExceptionFilter();

  it('maps an exhausted transient provider failure to a controlled 503', () => {
    const { host, status, json } = makeHost();

    filter.catch(
      new AIProviderUnavailableException('Gemini unavailable after 4 attempts', {
        provider: 'gemini',
        operation: 'blueprint',
        attempts: 4,
        httpStatus: 503,
        errorCategory: 'RETRYABLE_TRANSIENT',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      success: false,
      code: 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE',
      message: 'The story service is temporarily busy. Please try again shortly.',
      retryable: true,
    });
    expect(typeof body.trace_id).toBe('string');
    // No provider internals, prompts or credentials leak to the client.
    expect(JSON.stringify(body)).not.toMatch(/prompt|api[_-]?key|gemini/i);
  });

  it('keeps ordinary HTTP exceptions on their own status', () => {
    const { host, status, json } = makeHost();

    filter.catch(new HttpException('Nope', HttpStatus.FORBIDDEN), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json.mock.calls[0][0]).toMatchObject({ success: false, message: 'Nope' });
  });

  it('keeps unexpected internal failures as 500', () => {
    const { host, status, json } = makeHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json.mock.calls[0][0]).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });
});
