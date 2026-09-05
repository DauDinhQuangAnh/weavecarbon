# WeaveCarbon Release Readiness

- Current decision: **NOT READY**
- Reason: M5 controls are implemented, but no full isolated staging evidence bundle has been produced for this exact three-repository head set.
- Blocking P0 defects: none known after M1–M4.

A PASS is generated only by `.github/workflows/release-readiness.yml` in `full` mode after exact-head CI, critical staging smoke, core/RAG performance budgets, before/after operational telemetry and a full RPO/RTO restore drill all succeed. See `docs/modernization/M5-RELEASE-READINESS.md` for configuration and evidence requirements.
