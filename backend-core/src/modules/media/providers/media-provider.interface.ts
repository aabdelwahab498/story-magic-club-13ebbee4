export interface IMediaProvider {
  /**
   * Identifies the provider for logging and tracking.
   */
  get name(): string;

  /**
   * Generates the requested media.
   * @param storyId The ID of the story context
   * @param metadata Any additional data required for generation
   * @returns The generated media URL or a tracking ID
   */
  generate(storyId: string, metadata?: Record<string, any>): Promise<string>;

  /**
   * Generates an illustration based on a structured prompt.
   */
  generateIllustration?(
    prompt: any,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; provider: string; metadata: any }>;

  /**
   * Checks the status of an ongoing generation request.
   * @param trackingId The ID returned from generate() if async
   */
  status(
    trackingId: string,
  ): Promise<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>;

  /**
   * Cancels an ongoing generation request if supported by the provider.
   * @param trackingId The ID returned from generate()
   */
  cancel(trackingId: string): Promise<boolean>;
}
