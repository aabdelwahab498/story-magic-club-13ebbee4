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
    it('reads canonical illustration state from Backend Core', async () => {
      mock.onGet('/media/stories/123/illustrations').reply(200, {
        jobStatus: 'COMPLETED',
        totalPages: 1,
        illustrations: [{ pageNumber: 1, imageUrl: 'https://x/1.png', status: 'COMPLETED' }],
      });

      const result = await fetchIllustrations('123');
      expect(result).toMatchObject({ jobStatus: 'COMPLETED', totalPages: 1, completedPages: 1 });
      expect(result.illustrations[0].imageUrl).toBe('https://x/1.png');
    });

    it('returns an empty job when no media exists yet', async () => {
      mock.onGet('/media/stories/123/illustrations').reply(200, { jobStatus: 'NONE' });
      const result = await fetchIllustrations('123');
      expect(result).toMatchObject({ illustrations: [], totalPages: 0, jobStatus: 'NONE' });
    });
  });
});
