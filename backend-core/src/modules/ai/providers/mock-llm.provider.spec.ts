import { Test, TestingModule } from '@nestjs/testing';
import { MockLLMProvider } from './mock-llm.provider.js';

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockLLMProvider],
    }).compile();

    provider = module.get<MockLLMProvider>(MockLLMProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should generate a blueprint JSON string', async () => {
    const rawResponse = await provider.generateBlueprint({
      systemPrompt: 'System',
      userPrompt: 'User',
    });
    const parsed = JSON.parse(rawResponse);
    expect(parsed.title).toBe("Hero's Magical Discovery");
    expect(parsed.characters[0].name).toBe('Hero');
  });

  it('should fail if FAIL_PROVIDER is in prompt', async () => {
    await expect(
      provider.generateBlueprint({
        systemPrompt: '',
        userPrompt: 'FAIL_PROVIDER',
      }),
    ).rejects.toThrow('Simulated provider failure');
  });

  it('should return bad json if FAIL_JSON is in prompt', async () => {
    const res = await provider.generateBlueprint({
      systemPrompt: '',
      userPrompt: 'FAIL_JSON',
    });
    expect(res).toBe('{ invalid_json: ');
  });

  it('should return missing fields if FAIL_VALIDATION is in prompt', async () => {
    const res = await provider.generateBlueprint({
      systemPrompt: '',
      userPrompt: 'FAIL_VALIDATION',
    });
    expect(res).toContain('Missing characters');
  });

  it('should generate a story JSON string', async () => {
    const rawResponse = await provider.generateStory({
      systemPrompt: 'System',
      userPrompt: 'User',
    });
    const parsed = JSON.parse(rawResponse);
    expect(parsed.title).toBe("Hero's Magical Discovery");
    expect(parsed.pages.length).toBe(2);
  });

  it('should fail story if FAIL_PROVIDER is in prompt', async () => {
    await expect(
      provider.generateStory({ systemPrompt: '', userPrompt: 'FAIL_PROVIDER' }),
    ).rejects.toThrow('Simulated provider failure');
  });

  it('should return missing pages array if FAIL_VALIDATION_MISSING_PAGES is in prompt', async () => {
    const res = await provider.generateStory({
      systemPrompt: '',
      userPrompt: 'FAIL_VALIDATION_MISSING_PAGES',
    });
    expect(res).toContain('Missing pages array');
  });

  it('should return empty pages array if FAIL_VALIDATION_EMPTY_PAGES is in prompt', async () => {
    const res = await provider.generateStory({
      systemPrompt: '',
      userPrompt: 'FAIL_VALIDATION_EMPTY_PAGES',
    });
    const parsed = JSON.parse(res);
    expect(parsed.pages.length).toBe(0);
  });

  it('should evaluate quality', async () => {
    const quality = await provider.evaluateQuality('test story');
    expect(quality.passed).toBe(true);
    expect(quality.score).toBe(22);
  });
});
