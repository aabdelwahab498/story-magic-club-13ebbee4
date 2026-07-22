import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    basic_traffic: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/v2/health/ready`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'ready status is valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ready';
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);
}
