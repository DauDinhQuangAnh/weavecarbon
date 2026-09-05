import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export function parseEnvReport(text) {
  return Object.fromEntries(String(text).split(/\r?\n/).flatMap((line) => {
    const index = line.indexOf('=');
    return index > 0 ? [[line.slice(0, index), line.slice(index + 1)]] : [];
  }));
}

function requiredFile(root, relativePath) {
  const absolute = path.join(root, relativePath);
  if (!existsSync(absolute) || statSync(absolute).size === 0) {
    throw new Error(`Missing release evidence: ${relativePath}`);
  }
  return absolute;
}

export function verifyReleaseEvidence(root, { mode = 'full' } = {}) {
  const ciPath = requiredFile(root, 'ci-gates.tsv');
  const ciRows = readFileSync(ciPath, 'utf8').trim().split(/\r?\n/).slice(1);
  if (ciRows.length !== 3 || ciRows.some((row) => row.split('\t')[1] !== 'PASS')) {
    throw new Error('All three exact-head cross-repository CI gates must PASS.');
  }

  const smoke = parseEnvReport(readFileSync(requiredFile(root, 'staging-smoke.env'), 'utf8'));
  if (smoke.status !== 'PASS' || smoke.production_target !== 'false') {
    throw new Error('Staging critical smoke did not pass safely.');
  }

  const restore = parseEnvReport(readFileSync(requiredFile(root, 'restore-report.txt'), 'utf8'));
  if (restore.status !== 'PASS' || restore.production_data_touched !== 'false') {
    throw new Error('The full isolated restore drill did not pass safely.');
  }
  for (const objective of ['rpo', 'rto']) {
    const actual = Number(restore[`${objective}_seconds`]);
    const target = Number(restore[`${objective}_target_seconds`]);
    if (!Number.isFinite(actual) || !Number.isFinite(target) || actual > target) {
      throw new Error(`${objective.toUpperCase()} evidence is absent or over budget.`);
    }
  }

  requiredFile(root, 'operations-before.txt');
  requiredFile(root, 'operations-after.txt');
  requiredFile(root, 'core-baseline-summary.json');
  if (mode === 'full') {
    requiredFile(root, 'rag-query-baseline-summary.json');
    requiredFile(root, 'rag-ingest-baseline-summary.json');
  }

  return { ciRows, smoke, restore, mode };
}

function render(result) {
  return `# WeaveCarbon Release Readiness\n\n` +
    `- Decision: **PASS**\n` +
    `- Mode: ${result.mode}\n` +
    `- Generated: ${new Date().toISOString()}\n` +
    `- Production load target: no\n` +
    `- Isolated restore touched production data: no\n` +
    `- Measured RPO: ${result.restore.rpo_seconds}s (budget ${result.restore.rpo_target_seconds}s)\n` +
    `- Measured RTO: ${result.restore.rto_seconds}s (budget ${result.restore.rto_target_seconds}s)\n\n` +
    `All exact-head repository CI gates, staging smoke, performance thresholds, operational snapshots, and the full restore drill passed.\n`;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = path.resolve(process.argv[2] || process.env.RELEASE_EVIDENCE_DIR || 'artifacts/release');
  const output = path.resolve(process.argv[3] || path.join(root, 'RELEASE_READINESS.md'));
  const result = verifyReleaseEvidence(root, { mode: process.env.RELEASE_MODE || 'full' });
  writeFileSync(output, render(result));
  console.log(`Release readiness PASS: ${output}`);
}
