import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    auth_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '10s', target: 5 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || 'mock-jwt-token';

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  const meRes = http.get(`${BASE_URL}/api/v2/me`, params);
  check(meRes, {
    'me status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
