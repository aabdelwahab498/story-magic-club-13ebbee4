import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    ai_service_direct: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<15000'],
  },
};

const AI_URL = __ENV.AI_URL || 'http://localhost:8000';

export default function () {
  const payload = JSON.stringify({
    targetAge: 5,
    theme: 'ocean life',
    selGoal: 'kindness',
    readingLevel: 'beginner',
    language: 'en',
    pageCount: 5,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${AI_URL}/ai/story/plan`, payload, params);

  check(res, {
    'ai status is 200': (r) => r.status === 200,
  });

  sleep(5);
}
