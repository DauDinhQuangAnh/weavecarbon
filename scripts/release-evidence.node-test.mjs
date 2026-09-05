import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyReleaseEvidence } from './check-release-evidence.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'wc-release-evidence-'));
  writeFileSync(path.join(root, 'ci-gates.tsv'), 'repository\tstatus\tsha\turl\nfe\tPASS\ta\tu\nbe\tPASS\tb\tu\nrag\tPASS\tc\tu\n');
  writeFileSync(path.join(root, 'staging-smoke.env'), 'status=PASS\nproduction_target=false\n');
  writeFileSync(path.join(root, 'restore-report.txt'), 'status=PASS\nproduction_data_touched=false\nrpo_seconds=30\nrpo_target_seconds=60\nrto_seconds=40\nrto_target_seconds=60\n');
  for (const file of [
    'operations-before.txt', 'operations-after.txt', 'core-baseline-summary.json',
    'rag-query-baseline-summary.json', 'rag-ingest-baseline-summary.json'
  ]) writeFileSync(path.join(root, file), '{}\n');
  return root;
}

test('accepts a complete full release evidence bundle', () => {
  assert.equal(verifyReleaseEvidence(fixture()).mode, 'full');
});

test('rejects a failed repository gate', () => {
  const root = fixture();
  writeFileSync(path.join(root, 'ci-gates.tsv'), 'repository\tstatus\tsha\turl\nfe\tPASS\ta\tu\nbe\tFAIL\tb\tu\nrag\tPASS\tc\tu\n');
  assert.throws(() => verifyReleaseEvidence(root), /cross-repository CI gates/);
});

test('rejects a restore that exceeds the RTO', () => {
  const root = fixture();
  writeFileSync(path.join(root, 'restore-report.txt'), 'status=PASS\nproduction_data_touched=false\nrpo_seconds=30\nrpo_target_seconds=60\nrto_seconds=61\nrto_target_seconds=60\n');
  assert.throws(() => verifyReleaseEvidence(root), /RTO evidence/);
});
