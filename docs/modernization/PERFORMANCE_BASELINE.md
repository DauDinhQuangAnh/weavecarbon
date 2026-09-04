# WP-0B Frontend Performance and Delivery Baseline

- Measurement date: 2026-08-27
- Commit measured: `326ee9e12dd43f25353df996558b828cc17e14f6`
- Result: **PARTIAL** — local build/runtime and CI are measured; Docker image
  size and VPS runtime metrics are unavailable in this environment.
- Product behavior changes: none

## Measurement environment

- Windows 11 Pro 64-bit (`10.0.22631`)
- Intel Core i5-6500, 4 cores / 4 logical processors, 3.20 GHz
- 15.43 GiB visible RAM; about 6.68 GiB free at inventory time
- Node `24.11.1`, npm `11.6.4`
- Repository: `D:\hoctap\WCB\Weavecarbon`
- Docker is not installed. CI/Docker use Node 22, so local timings are not
  directly interchangeable with Linux CI/container timings.

## Build baseline

Command: `D:\hoctap\node\npm.cmd run build` with the existing `.next` cache.
This is deliberately labelled a warm local build, not a clean build.

| Measurement | Baseline |
| --- | ---: |
| Total wall time | 25.482 s |
| Turbopack compile | 3.9 s |
| TypeScript phase | 8.1 s |
| Static generation | 2.8 s |
| Routes reported by build | 62 |
| App-path manifest entries | 67 |

Artifact inventory after that build:

| Directory/artifact | Files | Bytes | Approx. MiB |
| --- | ---: | ---: | ---: |
| `.next/cache` | 96 | 971,431,050 | 926.43 |
| `.next/standalone` | 2,348 | 41,891,483 | 39.95 |
| `.next/static` | 221 | 12,767,254 | 12.18 |
| `public` | 212 | 13,633,175 | 13.00 |
| Runtime copy payload (`standalone + static + public`) | — | 68,291,912 | 65.13 |

The runtime-copy figure excludes the container base image and layer metadata; it
is not a Docker image size. `.next/cache` is build cache and is not copied into
the runtime image.

## Client chunk inventory

- 193 JavaScript files under `.next/static/chunks`
- 12,237,948 bytes total uncompressed
- 3,578,323 bytes when each file is independently gzip-compressed
- Largest file: `.next/static/chunks/0_oj-e1tv88cw.js`, 1,668,370 bytes
  uncompressed and 449,393 bytes gzip

These totals cover all generated route chunks; they are **not** a per-route first
load size and must not be interpreted as bytes downloaded by one navigation.
Route-specific bundle budgets belong to WP-FE3.

## Local production runtime

Method: start `.next/standalone/server.js` on loopback, poll `/` to readiness,
perform 5 warm-up requests, then make 50 sequential requests using one benchmark
process. No network or browser rendering time is included.

| Measurement | Baseline |
| --- | ---: |
| Readiness | 1,724.615 ms |
| `/` p50 | 18.834 ms |
| `/` p95 | 25.031 ms |
| `/` mean / max | 19.759 / 27.931 ms |
| Idle working set after samples | 128,585,728 bytes (122.63 MiB) |
| Idle private bytes after samples | 177,995,776 bytes (169.75 MiB) |

## CI and deployment baseline

GitHub Actions run for the measured commit:

- Frontend CI run `33036464704`: success in 68 s overall; parallel jobs were
  lint/typecheck 65 s, build 56 s, test 32 s and audit 22 s.
- Frontend deploy run `33036520694`: success in 135 s; the image build/push
  passed, but the VPS deployment step was skipped because the host was
  unreachable.

Production topology at this commit: Caddy is the only service publishing host
ports (80/443); it routes frontend traffic to port 3000 and `/api/*` plus
`/health` to backend port 4000. PostgreSQL and RAG have no published host ports.

## Unavailable measurements and follow-up

- Docker image size/history: Docker is absent, and anonymous GHCR manifest access
  returned HTTP 401. Measure compressed layers with authenticated registry access.
- VPS CPU/RAM and real-user route latency: VPS is unreachable from the current
  deploy workflows.
- Cold clean-install/clean-build time: not measured to avoid conflating package
  download/network variance with the warm build baseline.

No optimization claim or target is established by WP-0B. Re-run the same method
on the same class of runner before/after WP-FE3. Rollback is deletion/revert of
this documentation-only commit; generated `.next` artifacts remain ignored.

## M2 follow-up

The completed frontend modernization measurements and enforced route budgets are
recorded in [M2-FRONTEND-MODERNIZATION-PERFORMANCE.md](./M2-FRONTEND-MODERNIZATION-PERFORMANCE.md).
