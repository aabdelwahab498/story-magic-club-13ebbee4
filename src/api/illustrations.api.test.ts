import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { axiosInstance } from './client';
import { generateIllustrations, fetchIllustrations } from './illustrations.api';

describe('illustrations.api', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axiosInstance);
  });

  afterEach(() => {
    mock.reset();
  });

  describe('generateIllustrations', () => {
    it('should POST to generate illustrations endpoint', async () => {
      const mockData = { storyId: '123', status: 'GENERATING' };
      mock.onPost('/media/stories/123/illustrations').reply(200, mockData);

      const result = await generateIllustrations('123');
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchIllustrations', () => {
    it('reads persisted illustrations from the database', async () => {
      const result = await fetchIllustrations('00000000-0000-0000-0000-000000000000');
      expect(result).toMatchObject({ illustrations: [], totalPages: 0, jobStatus: 'NONE' });
    });
  });
});
