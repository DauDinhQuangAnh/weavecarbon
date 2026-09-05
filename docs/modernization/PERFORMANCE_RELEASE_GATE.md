# WP-PR1 Performance and Capacity Gate

- Harness: Grafana k6 2.2.0, pinned in `.github/workflows/release-readiness.yml`
- Target: isolated staging by default; the runner and k6 both reject production unless the exact emergency override is supplied
- Evidence: k6 JSON summaries plus pre/post operational snapshots

## Workloads and budgets

| Profile | Paths | Default p95 budget |
| --- | --- | ---: |
| Core read | authenticated dashboard, products list/detail, evidence metadata | 750–900 ms |
| Assessment write | batch save/item/finalize and authoritative carbon persistence | 1,500–2,500 ms |
| Report job | create and poll generated dataset report | 2,500 ms |
| RAG query | retrieved answer through the backend trust boundary | 10,000 ms |
| RAG ingest | one synthetic document, isolated from mixed traffic | 45,000 ms |

Global budgets are check rate >99%, request failure rate <1%, overall p95 <1,200 ms and p99 <2,500 ms for the core profile. The baseline shape ramps to five concurrent read users for three minutes; mutating work is limited to 0.2 iterations/second, report requests are bounded, and RAG ingest is always a separate one-iteration profile.

`deploy/capture-operational-snapshot-vps.sh` captures container CPU/RAM, PostgreSQL connections/cache/temp/deadlock counters, durable queue depth, backend counters/cache/queue metrics and RAG latency/queue metrics before and after the run. A budget failure exits non-zero and blocks the release decision. Optimization is allowed only after the evidence identifies a specific query, pool, queue, runtime or dependency bottleneck.

## Commands

Validate target policy without running load:

```bash
LOAD_BASE_URL=https://staging.example.com LOAD_ENVIRONMENT=staging \
  npm run performance:target:check
```

Run a local smoke when k6 is installed:

```bash
LOAD_BASE_URL=http://127.0.0.1:4100 LOAD_ENVIRONMENT=test \
LOAD_ALLOW_DEMO_LOGIN=true npm run performance:smoke
```

The full baseline, RAG profiles, operational snapshots and DR drill run together through the manual `M5 Release Readiness` workflow. Production hostname overrides are intentionally absent from that workflow.
