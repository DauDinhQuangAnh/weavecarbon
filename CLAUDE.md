# Handoff: verify the technical-debt refactor before trusting it

This file exists so a fresh Claude Code session (possibly on a different machine) has
the context to finish what the previous session could not: **running the test/build
suite it never got to run.**

## What happened

A full refactor roadmap (test infra, error boundaries, env config, splitting "god" files,
ESLint tightening) was executed across this repo and the sibling BE repo
(`BE_weavecarbon`, usually a sibling directory next to this one — see its `CLAUDE.md` for
the equivalent BE handoff). All work was done carefully — pure-function extractions with
barrel-export patterns that kept every consumer's import path unchanged.

**But for the last stretch of the session, the machine's C: drive had 0 bytes free.**
This made `npm test`, `npm run build`, and `npm run lint` all fail with ENOSPC. The final
change — re-tightening `eslint.config.mjs` (making `@typescript-eslint/no-explicit-any`
strict again and re-enabling 4 `react-hooks` rules that had been turned off) — was verified
only by running ESLint itself (which still worked read-only), **never followed by a full
`npm run build` or manual browser smoke test.** That's why you're reading this.

## Your task

1. `npm install` (confirm it completes cleanly).
2. `npm run lint` — expect **0 errors**. You should see ~22 warnings from 4 `react-hooks`
   rules (`refs`, `purity`, `set-state-in-effect`, `static-components`) across ~17 files —
   this is a known, intentional baseline (see "react-hooks warnings" below), not something
   to silently fix in bulk.
3. `npm test` (vitest) — should be clean. Test files as of this handoff:
   `lib/auth/routing.test.ts`, `lib/dashboard/accessGuards.test.ts`, `lib/carbon/engine.test.ts`,
   `lib/apiClient.test.ts`, `lib/demo/demoDataset.test.ts`, `components/ui/button.test.tsx`,
   `components/dashboard/overview/overviewPageHelpers.test.ts`. If the count differs,
   something's missing or extra.
4. `npm run build` — this is the important one, never run since `lib/apiClient.ts` and
   `contexts/AuthContext.tsx` were split into smaller modules, and since the ESLint rules
   above were re-tightened. A build failure here is the most likely place for something to
   have slipped through.
5. `npm run dev`, then manually smoke-test in a browser:
   - Sign in / sign out / token refresh (exercises the split `AuthContext.tsx` +
     `contexts/auth/{types,userBuilders,session}.ts`)
   - `/dashboard/export` and `/dashboard/overview` (exercises the split `ExportClient.tsx` /
     `OverviewPageClient.tsx` + their extracted `*Helpers.ts(x)` files)
   - Anything involving Vietnamese text near the overview page — there was a real Unicode
     escape-sequence bug caught and fixed in `overviewPageHelpers.tsx`'s diacritic-stripping
     regex this session; if garbled text shows up anywhere near market/category names, that's
     the place to look first.
6. If everything above is green: the refactor is done and verified. Report back and this
   handoff file can be deleted (it's a one-time task note, not a permanent doc).
7. If anything fails: fix it using the same discipline the rest of the session used —
   don't guess-patch, find the root cause, and if you change behavior anywhere, say so
   explicitly rather than silently "fixing" a test to match a bug.

## react-hooks warnings (don't bulk-fix blindly)

`eslint.config.mjs` re-enables `react-hooks/refs`, `react-hooks/purity`,
`react-hooks/set-state-in-effect`, and `react-hooks/static-components` as `"warn"` (they were
previously `"off"`). They surface ~22 real findings — mostly `setState` called synchronously
inside `useEffect` on mount/condition-check, a couple of ref-read-during-render cases, one
`Date.now()` call during render, and one component defined inside another component's render
body. These are legitimate patterns worth fixing eventually, but each one needs a
per-component judgment call and a browser check, not a mechanical bulk edit — that's why they
were left as `warn` instead of fixed outright or set back to `off`. If you have a working
build/test loop now, tackling a few of these (one file at a time, verified in the browser) is
reasonable follow-up work — just don't do all 17 files in one blind pass.

## Structural context you'll want

- `lib/apiClient.ts` is now a barrel re-exporting from `lib/apiClient/{storageUtils,
  authSnapshot,cache,guards,tokenStore,request}.ts`. `contexts/AuthContext.tsx` similarly
  pulls from `contexts/auth/{types,userBuilders,session}.ts`. Every external consumer still
  imports from the original two paths — that was verified by checking all consumers before
  the split, not by exhaustive testing, so if you touch either area, re-check that invariant.
- `lib/env.ts` (zod-validated `NEXT_PUBLIC_*` vars) is the new single source of truth for env
  vars; most call sites were migrated to it, but don't assume every last one was — grep for
  stray `process.env.NEXT_PUBLIC_` if you're touching env-related code.
