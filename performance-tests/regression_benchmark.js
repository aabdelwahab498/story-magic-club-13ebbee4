import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    regression: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10s',
    },
  },
  thresholds: {
    // Optimized endpoints should respond fast
    http_req_duration: ['p(95)<100'], 
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Benchmark Health Endpoint
  const healthRes = http.get(`${BASE_URL}/api/v2/health/ready`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Benchmark Metrics Endpoint
  const metricsRes = http.get(`${BASE_URL}/api/v2/metrics`);
  check(metricsRes, {
    'metrics status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}
