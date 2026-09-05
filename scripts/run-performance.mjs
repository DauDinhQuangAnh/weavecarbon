import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateLoadTarget } from './load-target-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const optionValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const profile = optionValue('--profile', process.env.LOAD_PROFILE || 'core');
const shape = optionValue('--shape', process.env.LOAD_SHAPE || 'smoke');
const scripts = {
  core: 'core-workload.js',
  'rag-query': 'rag-query.js',
  'rag-ingest': 'rag-ingest.js'
};

if (!Object.hasOwn(scripts, profile)) {
  throw new Error(`Unknown performance profile: ${profile}`);
}
if (!['smoke', 'baseline'].includes(shape)) {
  throw new Error(`Unknown load shape: ${shape}`);
}

const target = validateLoadTarget({
  baseUrl: process.env.LOAD_BASE_URL || 'http://127.0.0.1:4100',
  environment: process.env.LOAD_ENVIRONMENT || 'local',
  productionOverride: process.env.LOAD_PRODUCTION_OVERRIDE
});

console.log(`Validated ${profile}/${shape} target: ${target.baseUrl} (${target.environment})`);
if (target.production) {
  console.warn('WARNING: the explicit, approved production override is active.');
}
if (args.has('--validate-only')) {
  process.exit(0);
}

const artifactDir = path.resolve(
  root,
  process.env.LOAD_ARTIFACT_DIR || 'artifacts/performance'
);
mkdirSync(artifactDir, { recursive: true });

const executable = process.env.K6_BIN || 'k6';
const scriptPath = path.join(root, 'performance', 'k6', scripts[profile]);
const summaryPath = path.join(artifactDir, `${profile}-${shape}-summary.json`);
const result = spawnSync(executable, [
  'run',
  '--summary-export', summaryPath,
  scriptPath
], {
  cwd: root,
  env: {
    ...process.env,
    LOAD_BASE_URL: target.baseUrl,
    LOAD_ENVIRONMENT: target.environment,
    LOAD_SHAPE: shape,
    K6_TARGET_POLICY_VALIDATED: 'true'
  },
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
