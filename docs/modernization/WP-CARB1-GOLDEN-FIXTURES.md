# WP-CARB1 - Carbon Golden Fixtures

Work package status: PASS

Carbon authority status: UNCHANGED (frontend engine remains authoritative)

## Scope

This work package freezes the current numerical behavior of
`lib/carbon/engine.ts` before any carbon-authority migration. It adds a versioned
input/output fixture set and exact deep-equality tests; it does not change engine
logic, factor values, API contracts, persisted data or deployment topology.

## Frozen contract

Fixture version: `carbon-golden-v1`

Rule engine: `scope-quality-rss-1.0.0`

Calculation graph: `textile-pcf-2.1.0`

Methodology: `WeaveCarbon Attributional Textile PCF v2.1 - climate-only partial CFP`

| Case | Per-product total | Batch total | Scope 1 | Scope 2 | Scope 3 | 95% range | Confidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| documented-multistage-manufacturer | 4.577 | 5492.40 | 0 | 1.591 | 2.986 | 3.146-6.008 | medium / 77 |
| direct-fuel-scope1 | 6.869 | 68.69 | 1.342 | 0 | 5.527 | 4.525-9.213 | medium / 80 |
| brand-proxy-defaults | 1.743 | 87.15 | 0 | 0 | 1.743 | 0.859-2.627 | low / 32 |
| coverage-yield-normalization-edge | 11.106 | 11.11 | 0 | 0.709 | 10.397 | 8.209-14.003 | medium / 76 |
| zero-invalid-input-edge | 0 | 0 | 0 | 0 | 0 | 0-0 | low / 11 |

Together these cases cover explicit and proxy materials, accessory weights, packaging
and yield, grid/solar/gas/coal/wind energy, road/sea/rail/default logistics, Scope
1/2/3 aggregation, batch rounding, under-covered BOMs, normalized energy shares,
missing inputs, data-quality scores and RSS uncertainty.

The stable output projection compares the following with exact `toEqual` semantics:

- per-product and batch stage totals;
- cradle-to-gate, gate-to-market and reported totals;
- Scope 1/2/3, confidence, quality and uncertainty;
- data-quality axis scores and energy/stage breakdowns;
- factor IDs, versions, values, uncertainty CVs and proxy classifications;
- calculation/rule versions and fallback/coverage notes.

Presentation copy and full citation text are intentionally excluded from the numerical
golden projection. Factor identity, version and value remain included.

## Files and integrity

- `lib/carbon/fixtures/v1/inputs.json` contains reviewed representative inputs.
- `lib/carbon/fixtures/v1/expected.json` contains outputs captured from the unchanged
  current engine and formatted for human diff review.
- `lib/carbon/fixtures/goldenProjection.ts` defines the stable audit projection.
- `lib/carbon/golden.test.ts` validates fixture completeness/version alignment and runs
  every input against its exact expected output.

Fixture SHA-256 values at completion:

- inputs: `87C7A13E258D77F79225433C6D5FA2FFD9260AA1279649A6BFA19FCFB3717E1A`
- expected: `E86DB5B81AF922D0647BDFB6F7AD8A8B0F74B71F2F571C960CBF529EE05B4842`

## Change policy

WP-CARB1 fixtures must not be silently regenerated when a later engine differs. A
future intended methodology/factor change must record the numerical drift, preserve
`v1`, add a new versioned fixture set and explain why each changed number is accepted.
During backend-authority migration, both implementations must pass these same `v1`
inputs before authority can move.

## Verification evidence

- Carbon baseline before this work: 1 file / 14 tests passed.
- Carbon verification after this work: 2 files / 20 tests passed.
- Full frontend verification: 26 files / 124 tests passed, 1 test skipped.
- TypeScript typecheck passed.
- OpenAPI snapshot and generated transport types remained current.
- ESLint exited successfully with 0 errors and 21 pre-existing React warnings; no
  changed WP-CARB1 file emits a warning.
- Next.js production build passed and generated all 62 application routes.
- `git diff --check` passed.

## Remaining dependency

WP-CARB1 now unlocks WP-CARB2 together with the already completed WP-B1. WP-CARB2 must
implement a pure backend carbon core that reproduces this fixture set; it must not
change frontend authority or persisted calculation behavior yet.

## Rollback

Rollback is a normal revert of this work package. Only test fixtures, their projection
and documentation are added; runtime behavior and stored data are unaffected.
