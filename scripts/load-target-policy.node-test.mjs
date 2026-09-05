import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRODUCTION_OVERRIDE_PHRASE,
  validateLoadTarget
} from './load-target-policy.mjs';

test('accepts an HTTPS staging target', () => {
  assert.deepEqual(
    validateLoadTarget({
      baseUrl: 'https://staging.weavecarbon.example/',
      environment: 'staging'
    }),
    {
      baseUrl: 'https://staging.weavecarbon.example',
      environment: 'staging',
      hostname: 'staging.weavecarbon.example',
      production: false
    }
  );
});

test('accepts HTTP only for loopback targets', () => {
  assert.equal(validateLoadTarget({
    baseUrl: 'http://127.0.0.1:4100',
    environment: 'test'
  }).production, false);

  assert.throws(() => validateLoadTarget({
    baseUrl: 'http://staging.example.test',
    environment: 'staging'
  }), /must use HTTPS/);
});

test('blocks the live WeaveCarbon host by default', () => {
  assert.throws(() => validateLoadTarget({
    baseUrl: 'https://weavecarbon.com',
    environment: 'staging'
  }), /Production load testing is blocked/);
});

test('requires both the exact override and production declaration', () => {
  assert.throws(() => validateLoadTarget({
    baseUrl: 'https://weavecarbon.com',
    environment: 'staging',
    productionOverride: PRODUCTION_OVERRIDE_PHRASE
  }), /must declare LOAD_ENVIRONMENT=production/);

  assert.equal(validateLoadTarget({
    baseUrl: 'https://weavecarbon.com',
    environment: 'production',
    productionOverride: PRODUCTION_OVERRIDE_PHRASE
  }).production, true);
});

test('rejects credentials and unsupported environments', () => {
  assert.throws(() => validateLoadTarget({
    baseUrl: 'https://user:secret@staging.example.test',
    environment: 'staging'
  }), /must not be embedded/);
  assert.throws(() => validateLoadTarget({
    baseUrl: 'https://staging.example.test',
    environment: 'qa'
  }), /LOAD_ENVIRONMENT/);
});
