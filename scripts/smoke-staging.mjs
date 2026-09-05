import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { validateLoadTarget } from './load-target-policy.mjs';

const target = validateLoadTarget({
  baseUrl: process.env.LOAD_BASE_URL,
  environment: process.env.LOAD_ENVIRONMENT || 'staging',
  productionOverride: process.env.LOAD_PRODUCTION_OVERRIDE
});
const apiRoot = `${target.baseUrl}${process.env.LOAD_API_PREFIX || '/api'}`;
const reportPath = path.resolve(process.env.SMOKE_REPORT_PATH || 'artifacts/release/staging-smoke.env');
mkdirSync(path.dirname(reportPath), { recursive: true });

async function request(url, options = {}) {
  const started = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), ...options });
  const durationMs = Math.round(performance.now() - started);
  if (!response.ok) throw new Error(`${url} returned ${response.status} in ${durationMs}ms`);
  return { response, durationMs };
}

const timings = [];
try {
  const root = await request(`${target.baseUrl}/health`);
  timings.push(`health_ms=${root.durationMs}`);

  let token = process.env.LOAD_ACCESS_TOKEN;
  if (!token) {
    if (process.env.LOAD_ALLOW_DEMO_LOGIN !== 'true') {
      throw new Error('Staging smoke requires LOAD_ACCESS_TOKEN or LOAD_ALLOW_DEMO_LOGIN=true.');
    }
    const demo = await request(`${apiRoot}/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'b2b', demo_scenario: 'sample_data' })
    });
    token = (await demo.response.json())?.data?.tokens?.access_token;
    if (!token) throw new Error('Staging demo login did not return an access token.');
    timings.push(`auth_demo_ms=${demo.durationMs}`);
  }

  const headers = { Authorization: `Bearer ${token}` };
  for (const [name, route] of [
    ['dashboard', '/dashboard/overview?trend_months=12'],
    ['products', '/products?page=1&page_size=5'],
    ['evidence', '/evidence?page=1&page_size=5']
  ]) {
    const result = await request(`${apiRoot}${route}`, { headers });
    timings.push(`${name}_ms=${result.durationMs}`);
  }

  writeFileSync(reportPath, [
    'status=PASS',
    'production_target=false',
    `target_environment=${target.environment}`,
    `completed_at_utc=${new Date().toISOString()}`,
    ...timings,
    ''
  ].join('\n'), { mode: 0o600 });
  console.log(`Staging smoke PASS; report: ${reportPath}`);
} catch (error) {
  writeFileSync(reportPath, [
    'status=FAIL',
    'production_target=false',
    `target_environment=${target.environment}`,
    `completed_at_utc=${new Date().toISOString()}`,
    `error=${String(error.message).replace(/[\r\n=]/g, ' ')}`,
    ''
  ].join('\n'), { mode: 0o600 });
  throw error;
}
