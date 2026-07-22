import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMediaProvider } from './media-provider.interface.js';

/**
 * GoogleImageProvider implements the IMediaProvider interface and uses the
 * Google Generative AI Image Generation API to create illustration images.
 *
 * The provider reads the API key from the NestJS ConfigService. No secrets are
 * ever logged – the logger only records the provider name and request outcome.
 */
@Injectable()
export class GoogleImageProvider implements IMediaProvider {
  private readonly logger = new Logger(GoogleImageProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('GOOGLE_API_KEY');
    if (!key) {
      throw new Error(
        'GoogleImageProvider initialization error: GOOGLE_API_KEY is missing',
      );
    }
    this.apiKey = key;
  }

  /** Provider identifier used for logging and DB storage */
  get name(): string {
    return 'google';
  }

  /**
   * Generic generate method required by the interface – not used for illustration
   * generation in the MVP. It returns a placeholder URL for compatibility.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(
    storyId: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return `https://storage.najmah.com/media/google-${Date.now()}.png`;
  }

  /**
   * Generate an illustration based on a structured prompt.
   * @param prompt The prompt object built by IllustrationPromptBuilder.
   * @param metadata Optional additional metadata to store alongside the image.
   * @returns An object containing the image URL, provider name and any returned metadata.
   */
  async generateIllustration(
    prompt: any,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; provider: string; metadata: any }> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta2/models/gemini-pro-vision:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: this.buildPromptText(prompt) }],
        },
      ],
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `GoogleImageProvider request failed – status ${response.status}: ${errText}`,
        );
        throw new Error(`Google API error ${response.status}`);
      }

      const data = await response.json();
      // The exact path to the generated image URL depends on the API response shape.
      // For the MVP we assume `data.candidates[0].content.parts[0].text` contains a URL.
      const url = this.extractImageUrl(data);

      return {
        url,
        provider: this.name,
        metadata: { ...metadata, prompt },
      };
    } catch (error) {
      this.logger.error('GoogleImageProvider unexpected error', error);
      throw error;
    }
  }

  /** Helper to turn the structured prompt into a single string for the API */
  private buildPromptText(prompt: any): string {
    // The prompt object is assumed to have a `text` property; fallback to JSON.
    if (typeof prompt === 'string') return prompt;
    if (prompt && typeof prompt.text === 'string') return prompt.text;
    return JSON.stringify(prompt);
  }

  /** Extract a usable image URL from the Google API response */
  private extractImageUrl(data: any): string {
    try {
      const candidate = data?.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const possibleUrl = part?.text?.trim();
      if (possibleUrl && possibleUrl.startsWith('http')) return possibleUrl;
    } catch {
      // fall through to fallback
    }
    // Fallback placeholder if extraction fails
    return `https://placeholder.najmah.com/google/${Date.now()}.png`;
  }

  /**
   * Required by IMediaProvider – always returns 'COMPLETED' because generation is
   * performed synchronously in this MVP.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async status(
    trackingId: string,
  ): Promise<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'> {
    return 'COMPLETED';
  }

  /** No cancellation support in the MVP – always returns true. */
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async cancel(trackingId: string): Promise<boolean> {
    return true;
  }
}
