import { Injectable } from '@nestjs/common';
import { AIParseException } from '../../exceptions/ai.exceptions.js';

@Injectable()
export class GeminiParser {
  /**
   * Cleans the raw markdown response from Gemini by stripping markdown wrappers.
   * Does NOT parse the JSON itself (that is handled by the Planner/Writer),
   * but prepares a clean string ready for JSON.parse.
   */
  extractJsonString(rawResponse: string): string {
    if (!rawResponse || typeof rawResponse !== 'string') {
      throw new AIParseException(
        'Empty or invalid response from Gemini provider',
        rawResponse ? String(rawResponse) : '',
      );
    }

    let cleaned = rawResponse.trim();

    // Strip starting markdown json block
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring('```json'.length);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring('```'.length);
    }

    // Strip ending markdown block
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }

    cleaned = cleaned.trim();

    if (cleaned.length === 0) {
      throw new AIParseException(
        'Response from Gemini contained no valid JSON data after markdown stripping',
        rawResponse,
      );
    }

    return cleaned;
  }
}
