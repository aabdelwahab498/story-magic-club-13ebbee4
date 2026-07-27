// backend-core/src/modules/media/providers/audio/audio-provider.interface.ts
export interface IAudioProvider {
  /**
   * Identifies the provider for logging and tracking.
   */
  get name(): string;

  /**
   * Generates narration audio for a story.
   * @param storyId The ID of the story context.
   * @param metadata Additional options such as text, language, and voice.
   * @returns The generated audio URL.
   */
  generate(
    storyId: string,
    metadata: {
      text: string;
      language: string;
      voice?: string;
    },
  ): Promise<string>;
}
