const PRODUCTION_HOSTS = new Set([
  'weavecarbon.com',
  'www.weavecarbon.com'
]);

const NON_PRODUCTION_ENVIRONMENTS = new Set([
  'local',
  'development',
  'test',
  'staging'
]);

export const PRODUCTION_OVERRIDE_PHRASE = 'I_UNDERSTAND_THIS_TARGETS_PRODUCTION';

export function validateLoadTarget({
  baseUrl,
  environment,
  productionOverride = ''
}) {
  const normalizedEnvironment = String(environment || '').trim().toLowerCase();
  let parsed;

  try {
    parsed = new URL(String(baseUrl || '').trim());
  } catch {
    throw new Error('LOAD_BASE_URL must be an absolute http(s) URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http(s) load-test targets are supported.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials must not be embedded in LOAD_BASE_URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (parsed.protocol !== 'https:' && !isLoopback) {
    throw new Error('Non-loopback load-test targets must use HTTPS.');
  }

  const looksProduction = PRODUCTION_HOSTS.has(hostname)
    || hostname.startsWith('prod.')
    || hostname.includes('.prod.')
    || normalizedEnvironment === 'production';

  if (looksProduction) {
    if (productionOverride !== PRODUCTION_OVERRIDE_PHRASE) {
      throw new Error(
        `Production load testing is blocked. Set LOAD_PRODUCTION_OVERRIDE=${PRODUCTION_OVERRIDE_PHRASE} only during an approved production exercise.`
      );
    }
    if (normalizedEnvironment !== 'production') {
      throw new Error('A production-looking hostname must declare LOAD_ENVIRONMENT=production.');
    }
  } else if (!NON_PRODUCTION_ENVIRONMENTS.has(normalizedEnvironment)) {
    throw new Error('LOAD_ENVIRONMENT must be local, development, test, or staging.');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');

  return {
    baseUrl: parsed.toString().replace(/\/$/, ''),
    environment: normalizedEnvironment,
    hostname,
    production: looksProduction
  };
}
