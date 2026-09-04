# Security Finding Waiver Policy

Security gates fail on committed secrets and on fixed Critical vulnerabilities in
source dependencies or release images. A finding may be waived only when all of
the following are recorded in a reviewed pull request:

- scanner, advisory/CVE identifier, affected package or image layer;
- exploitability analysis for the deployed WeaveCarbon runtime;
- compensating control and named owner;
- approval by a repository maintainer and security reviewer;
- expiry date no later than 30 days, with a linked remediation issue.

Waivers must be narrow suppressions tied to the exact identifier. Blanket scanner
disablement, unbounded expiry, and suppressing unfixed Critical findings without
an exploitability review are not accepted. CI artifacts retain the source SBOM;
release images retain BuildKit SBOM and provenance attestations in GHCR.
