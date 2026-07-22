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
    it('should GET illustrations endpoint', async () => {
      const mockData = [{ pageNumber: 1, imageUrl: 'test.jpg', status: 'COMPLETED' }];
      mock.onGet('/media/stories/123/illustrations').reply(200, mockData);

      const result = await fetchIllustrations('123');
      expect(result).toEqual(mockData);
    });
  });
});
