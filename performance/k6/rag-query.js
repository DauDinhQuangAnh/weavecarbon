import { sleep } from 'k6';
import http from 'k6/http';
import {
  API_ROOT,
  acquireAccessToken,
  authHeaders,
  parseJson,
  readScenario,
  record,
  trends
} from './helpers.js';

const shape = __ENV.LOAD_SHAPE || 'smoke';
const collection = __ENV.LOAD_RAG_COLLECTION;
if (!collection) throw new Error('LOAD_RAG_COLLECTION is required for the RAG query profile.');

export const options = {
  scenarios: { rag_query: readScenario(shape, 'ragQuery') },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    wc_rag_query_duration: ['p(95)<10000', 'p(99)<20000']
  }
};

export function setup() {
  return { token: acquireAccessToken() };
}

export function ragQuery(data) {
  const response = record(http.post(
    `${API_ROOT}/ai-config/rag/collections/${encodeURIComponent(collection)}/query`,
    JSON.stringify({
      query: __ENV.LOAD_RAG_QUERY || 'What evidence supports this carbon assessment?',
      columns_to_answer: ['chunk'],
      number_docs_retrieval: Number(__ENV.LOAD_RAG_DOCUMENTS || 3),
      include_debug_info: false
    }),
    { headers: authHeaders(data.token), tags: { endpoint: 'rag_query' }, timeout: '30s' }
  ), trends.ragQuery, 'RAG query');
  parseJson(response, 'RAG query');
  sleep(1);
}
