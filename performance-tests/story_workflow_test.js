import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    story_generation: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<15000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || 'mock-jwt-token';

export default function () {
  const payload = JSON.stringify({
    targetAge: 5,
    theme: 'space adventure',
    selGoal: 'sharing',
    readingLevel: 'beginner',
    language: 'en',
    pageCount: 5,
  });

  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/v2/stories/plan`, payload, params);

  check(res, {
    'story status is 200/201 or 401': (r) => r.status === 200 || r.status === 201 || r.status === 401,
  });

  sleep(5);
}
