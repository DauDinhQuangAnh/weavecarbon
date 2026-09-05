import { check, fail } from 'k6';
import http from 'k6/http';
import {
  API_ROOT,
  acquireAccessToken,
  record,
  trends
} from './helpers.js';

const collection = __ENV.LOAD_RAG_COLLECTION;
if (!collection) throw new Error('LOAD_RAG_COLLECTION is required for the RAG ingest profile.');
if (__ENV.LOAD_ENABLE_RAG_INGEST !== 'true') {
  throw new Error('RAG ingest is destructive to staging state; set LOAD_ENABLE_RAG_INGEST=true explicitly.');
}

const fixture = open('../fixtures/rag-load-fixture.txt', 'b');

export const options = {
  scenarios: {
    rag_ingest: { executor: 'shared-iterations', exec: 'ragIngest', vus: 1, iterations: 1, maxDuration: '2m' }
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    wc_rag_ingest_duration: ['p(95)<45000']
  }
};

export function setup() {
  if (__ENV.LOAD_ENVIRONMENT !== 'staging' && __ENV.LOAD_ENVIRONMENT !== 'test') {
    fail('RAG ingest is permitted only in staging or test.');
  }
  return { token: acquireAccessToken() };
}

export function ragIngest(data) {
  const response = record(http.post(`${API_ROOT}/ai-config/rag/ingest`, {
    collection_name: collection,
    chunking_profile: 'default',
    file: http.file(fixture, `m5-load-${Date.now()}.txt`, 'text/plain')
  }, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { endpoint: 'rag_ingest' },
    timeout: '90s'
  }), trends.ragIngest, 'RAG ingest');
  check(response, { 'RAG ingest produced a response body': (value) => value.body?.length > 0 });
}
