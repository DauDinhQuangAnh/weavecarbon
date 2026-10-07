# Industrial demo data — 8 October 2026

The twelve new `/demo` routes use labelled, read-only synthetic data. The real routes retain their API loaders, auth and subscription policies. No production database seed or migration is needed.

- Facilities/processes/activity: 3 facilities, 3 processes, 5 activities and 2 measurement points.
- Evidence graph/review: 3 document examples; locked, pending and missing-checksum cases; selection resolves each activity's own lineage. Checksums are format examples, not hashes of actual files. Reviews are simulated internal reviews, never independent assurance.
- Emissions/hotspots: August and September 2026 snapshots; September revision 2 supersedes revision 1. Scope 2 uses the location-based view. Market-based data remains unavailable. Totals reconcile with displayed source lines; CSV uses the existing escaping rules.
- Inbox: tasks derived from the demo activities, evidence and factor proposals, including missing sources and pending review.
- Compliance: a synthetic capability registry with partial/planned preparation gates; no certification or submission acceptance.
- Data quality/Vietnam carbon/connected data: dedicated demo views with activity selection, factors, monitoring plans and simulated calibration cases. The existing `/demo/data-governance`, `/demo/vn-mrv` and `/demo/weavenode` pages remain unchanged. No device is actually connected.

The shared industrial clients load fixtures with dynamic imports only in their demo branch. The three dedicated demo views import fixtures within their demo routes. Demo mutations remain disabled even for an authenticated tenant administrator. The protected demo dataset, adapter, nine existing pages and backend are unchanged.

Verification: 40 targeted tests, including 17 demo tests covering all twelve entry points, selection/filtering, missing evidence, write prevention and no production API calls; `npm run check`; production build; all eight bundle budgets; 665 protected baseline files unchanged. Local build: 14,217,914 emitted client JS bytes against the unchanged 14,500,000 budget.
