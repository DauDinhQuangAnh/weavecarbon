import { check, group, sleep } from 'k6';
import http from 'k6/http';
import {
  API_ROOT,
  acquireAccessToken,
  authHeaders,
  commonThresholds,
  findFirstProduct,
  parseJson,
  readScenario,
  record,
  trends
} from './helpers.js';

const shape = __ENV.LOAD_SHAPE || 'smoke';
const mutationEnabled = __ENV.LOAD_ENABLE_MUTATIONS === 'true';
const reportEnabled = __ENV.LOAD_ENABLE_REPORT_JOBS === 'true';

const scenarios = { core_read: readScenario(shape, 'coreRead') };
if (mutationEnabled) {
  scenarios.assessment_write = shape === 'baseline'
    ? { executor: 'constant-arrival-rate', exec: 'assessmentWrite', rate: 2, timeUnit: '10s', duration: '2m', preAllocatedVUs: 1, maxVUs: 3 }
    : { executor: 'shared-iterations', exec: 'assessmentWrite', vus: 1, iterations: 1, maxDuration: '1m' };
}
if (reportEnabled) {
  scenarios.report_job = { executor: 'shared-iterations', exec: 'reportJob', vus: 1, iterations: shape === 'baseline' ? 5 : 1, maxDuration: '2m' };
}

export const options = {
  scenarios,
  thresholds: commonThresholds(),
  discardResponseBodies: false
};

export function setup() {
  const token = acquireAccessToken();
  const response = http.get(`${API_ROOT}/products?page=1&page_size=5`, {
    headers: authHeaders(token),
    tags: { endpoint: 'products_setup' }
  });
  if (response.status !== 200) throw new Error(`Product fixture discovery failed: ${response.status}`);
  const firstProduct = findFirstProduct(parseJson(response, 'Product fixture discovery'));
  return { token, productId: __ENV.LOAD_PRODUCT_ID || firstProduct?.id || null };
}

export function coreRead(data) {
  const params = { headers: authHeaders(data.token) };

  group('authenticated dashboard', () => {
    record(http.get(`${API_ROOT}/dashboard/overview?trend_months=12`, {
      ...params, tags: { endpoint: 'dashboard' }
    }), trends.dashboard, 'dashboard');
  });

  group('product list and detail', () => {
    record(http.get(`${API_ROOT}/products?page=1&page_size=20`, {
      ...params, tags: { endpoint: 'product_list' }
    }), trends.productList, 'product list');
    if (data.productId) {
      record(http.get(`${API_ROOT}/products/${encodeURIComponent(data.productId)}`, {
        ...params, tags: { endpoint: 'product_detail' }
      }), trends.productDetail, 'product detail');
    }
  });

  group('evidence metadata', () => {
    record(http.get(`${API_ROOT}/evidence?page=1&page_size=20`, {
      ...params, tags: { endpoint: 'evidence_metadata' }
    }), trends.evidenceMetadata, 'evidence metadata');
  });
  sleep(0.5);
}

export function assessmentWrite(data) {
  if (!data.productId) throw new Error('A staging product fixture is required for assessment writes.');
  const headers = authHeaders(data.token);
  const suffix = `${Date.now()}-${__VU}-${__ITER}`;

  const created = record(http.post(
    `${API_ROOT}/product-batches`,
    JSON.stringify({ name: `M5 load ${suffix}`, description: 'Isolated staging performance fixture' }),
    { headers, tags: { endpoint: 'assessment_save' } }
  ), trends.assessmentSave, 'assessment save', [201]);
  const batch = parseJson(created, 'Assessment save')?.data;
  const batchId = batch?.id;
  check(batchId, { 'assessment returned an id': Boolean });
  if (!batchId) return;

  record(http.post(
    `${API_ROOT}/product-batches/${encodeURIComponent(batchId)}/items`,
    JSON.stringify({ product_id: data.productId, quantity: 1 }),
    { headers, tags: { endpoint: 'assessment_item' } }
  ), trends.assessmentSave, 'assessment item', [201]);

  record(http.patch(
    `${API_ROOT}/product-batches/${encodeURIComponent(batchId)}/publish`,
    null,
    { headers, tags: { endpoint: 'assessment_finalize' } }
  ), trends.assessmentFinalize, 'assessment finalize');

  record(http.post(
    `${API_ROOT}/carbon-calculations`,
    JSON.stringify({
      product_id: data.productId,
      calculation_type: 'product_carbon_footprint',
      carbon_input: {
        validationMode: 'strict',
        productCategory: 'textile',
        unitMassKg: 0.25,
        quantity: 1,
        materials: [],
        accessories: [],
        processFactorIds: [],
        energyMix: [],
        transport: []
      },
      notes: `M5 isolated load fixture ${suffix}`
    }),
    { headers, tags: { endpoint: 'carbon_calculation' } }
  ), trends.carbon, 'carbon calculation', [201]);
}

export function reportJob(data) {
  const headers = authHeaders(data.token);
  const created = record(http.post(
    `${API_ROOT}/reports/exports`,
    JSON.stringify({ dataset_type: 'product', file_format: 'csv', title: `M5 staging ${Date.now()}` }),
    { headers, tags: { endpoint: 'report_create' } }
  ), trends.reportJob, 'report create', [202]);
  const reportId = parseJson(created, 'Report create')?.data?.report_id;
  if (!reportId) return;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = record(http.get(
      `${API_ROOT}/reports/${encodeURIComponent(reportId)}/status`,
      { headers, tags: { endpoint: 'report_status' } }
    ), trends.reportJob, 'report status');
    const state = parseJson(status, 'Report status')?.data?.status;
    if (state === 'completed' || state === 'failed') break;
    sleep(0.5);
  }
}
