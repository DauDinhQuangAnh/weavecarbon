# WeaveCarbon Release Readiness

- Current decision: **NOT READY**
- Modernization implementation: **COMPLETE**
- Staging: **ISOLATED STACK CONFIGURED AFTER THE 2026-09-05 DEFERRAL**; the
  full M5 release-readiness evidence has not been produced for the current
  three-repository head set.
- Current-release P0 assessment: pending exact-head release checks.

A PASS is generated only by `.github/workflows/release-readiness.yml` in `full` mode after exact-head CI, critical staging smoke, core/RAG performance budgets, before/after operational telemetry and a full RPO/RTO restore drill all succeed. See `docs/MODERNIZATION.md` for the consolidated program status and release boundary.

The `deferred` workflow mode records an implementation closeout after exact-head CI, but is structurally unable to issue a release PASS. The staging stack alone is not certification: run the full workflow before commercial launch, material traffic growth, or a high-risk state migration.
