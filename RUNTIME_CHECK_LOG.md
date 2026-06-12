 # Frontend Runtime Check Log

 | Command | Result | Exact Error | Likely Responsible File | Notes |
 | ------- | ------ | ----------- | ----------------------- | ----- |
 | `npm run lint` | BLOCKED | `npm : File D:\hoctap\node\npm.ps1 cannot be loaded because running scripts is disabled on this system.` | PowerShell execution policy, not application source | Initial direct `npm` invocation is blocked in this shell; used `npm.cmd` for requested checks. |
 | `npm.cmd run lint` | PASS | none | none | `eslint .` completed successfully. |
 | `npm.cmd run typecheck` | PASS | none | none | `tsc --noEmit` completed successfully. |
 | `npm.cmd run build` | PASS | none | none | `next build` completed successfully with Next.js 16.1.6; 35 static/dynamic app routes generated. |
 | `npm.cmd run check` | PASS | none | none | Combined lint and typecheck completed successfully. |
 | `npm.cmd run dev` then GET `/` | PASS | none | none | Started bounded dev probe, root returned HTTP 200 on port 3000, then stopped the Weavecarbon process. Response started with HTML for `lang="vi"`. |
