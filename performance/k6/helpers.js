import { check, fail } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

export const BASE_URL = String(__ENV.LOAD_BASE_URL || '').replace(/\/$/, '');
export const API_ROOT = `${BASE_URL}${__ENV.LOAD_API_PREFIX || '/api'}`;

const productionHosts = new Set(['weavecarbon.com', 'www.weavecarbon.com']);
const targetHost = (() => {
  const match = BASE_URL.match(/^https?:\/\/([^/:?#]+)/i);
  return match ? match[1].toLowerCase() : '';
})();

if (__ENV.K6_TARGET_POLICY_VALIDATED !== 'true') {
  throw new Error('Run performance tests through scripts/run-performance.mjs.');
}
if (productionHosts.has(targetHost) && __ENV.LOAD_PRODUCTION_OVERRIDE !== 'I_UNDERSTAND_THIS_TARGETS_PRODUCTION') {
  throw new Error('Production target blocked by the k6 runtime guard.');
}

export const trends = {
  dashboard: new Trend('wc_dashboard_duration', true),
  productList: new Trend('wc_product_list_duration', true),
  productDetail: new Trend('wc_product_detail_duration', true),
  assessmentSave: new Trend('wc_assessment_save_duration', true),
  assessmentFinalize: new Trend('wc_assessment_finalize_duration', true),
  carbon: new Trend('wc_carbon_duration', true),
  reportJob: new Trend('wc_report_job_duration', true),
  evidenceMetadata: new Trend('wc_evidence_metadata_duration', true),
  ragQuery: new Trend('wc_rag_query_duration', true),
  ragIngest: new Trend('wc_rag_ingest_duration', true)
};

export function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

export function record(response, trend, name, accepted = [200]) {
  trend.add(response.timings.duration);
  check(response, {
    [`${name} returned an accepted status`]: (value) => accepted.includes(value.status)
  });
  return response;
}

export function parseJson(response, context) {
  try {
    return response.json();
  } catch {
    fail(`${context} did not return JSON (status ${response.status}).`);
  }
}

export function acquireAccessToken() {
  if (__ENV.LOAD_ACCESS_TOKEN) return __ENV.LOAD_ACCESS_TOKEN;
  if (__ENV.LOAD_ALLOW_DEMO_LOGIN !== 'true') {
    fail('Set LOAD_ACCESS_TOKEN, or explicitly set LOAD_ALLOW_DEMO_LOGIN=true on isolated staging.');
  }

  const response = http.post(
    `${API_ROOT}/auth/demo`,
    JSON.stringify({ role: 'b2b', demo_scenario: __ENV.LOAD_DEMO_SCENARIO || 'sample_data' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'auth_demo_setup' } }
  );
  if (response.status !== 200) fail(`Demo login failed with status ${response.status}.`);
  const body = parseJson(response, 'Demo login');
  const token = body?.data?.tokens?.access_token;
  if (!token) fail('Demo login response did not contain an access token.');
  return token;
}

export function findFirstProduct(body) {
  const candidates = [
    body?.data?.items,
    body?.data?.products,
    body?.data?.data,
    body?.data
  ];
  const list = candidates.find(Array.isArray) || [];
  return list[0] || null;
}

export function commonThresholds() {
  return {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1200', 'p(99)<2500'],
    wc_dashboard_duration: ['p(95)<750'],
    wc_product_list_duration: ['p(95)<750'],
    wc_product_detail_duration: ['p(95)<900'],
    wc_assessment_save_duration: ['p(95)<1500'],
    wc_assessment_finalize_duration: ['p(95)<2500'],
    wc_carbon_duration: ['p(95)<1500'],
    wc_report_job_duration: ['p(95)<2500'],
    wc_evidence_metadata_duration: ['p(95)<900']
  };
}

export function readScenario(shape, exec) {
  if (shape === 'baseline') {
    return {
      executor: 'ramping-vus',
      exec,
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '2m', target: 5 },
        { duration: '30s', target: 0 }
      ],
      gracefulRampDown: '15s'
    };
  }
  return { executor: 'shared-iterations', exec, vus: 1, iterations: 3, maxDuration: '1m' };
}
