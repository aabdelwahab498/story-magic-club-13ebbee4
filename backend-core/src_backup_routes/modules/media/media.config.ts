import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MediaConfigService provides configuration values for the Media Engine.
 * It abstracts access to environment variables or NestJS ConfigService so that
 * other media components (providers, services, etc.) can retrieve settings
 * without directly depending on process.env. This aids testability and keeps
 * configuration logic in a single place.
 *
 * Expected environment variables (defined in .env or CI settings):
 *   - IMAGE_PROVIDER: Identifier of the media provider to use (e.g., 'google', 'mock').
 *   - GOOGLE_API_KEY: API key for Google Image Generation (required when IMAGE_PROVIDER is 'google').
 */
@Injectable()
export class MediaConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns the selected image provider name.
   * Defaults to 'mock' if not configured.
   */
  getImageProvider(): string {
    return this.configService.get<string>('IMAGE_PROVIDER') ?? 'mock';
  }

  /**
   * Retrieves the Google API key for image generation.
   * Returns undefined if not set; callers should handle the missing key.
   */
  getGoogleApiKey(): string | undefined {
    return this.configService.get<string>('GOOGLE_API_KEY');
  }
}
