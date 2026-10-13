# Proof for #111: the first slice in the sandbox, production prepared

Deployment names are written `<sandbox>` and `<production>` in these files.

- **Red:** `red-deploy.txt`, `deploy.test.ts` failing 8 of 16 before the workflows uploaded the website and ran `prepareWebsiteFlag`. `red-handshake.txt`, the handshake's happy path still expecting `getMyProfile`'s shape from before the home slice.
- **Green:** `green-deploy.txt` (16/16) and `green-handshake.txt` (17/17, on a local backend on 3410/3411 with the mock on 3413).
- **Gate:** `gate.txt`, `pnpm gate` on the landed tree.
- **The workflow's steps, run as written:** `local-workflow-steps.txt` against the local backend; `sandbox-deploy.txt` against the sandbox, from `spec/website`.
- **The sandbox, running:** `sandbox-curl.txt` (the shell with its CSP, a deep link, Convex Auth's discovery and JWKS, the Slack routes still first) and `sandbox-sign-in-light.png`, `sandbox-sign-in-dark.png` (the flag is on there, so the shell offers Sign in with Slack).
- **The flag:** `flag-definition.txt`, and `flag-production-off-sandbox-on.txt`. That file shows a local backend reading the real definition through a proxy that forwards only `/flags/definitions`. It answers off under `KUDOS_ENVIRONMENT=production` and on under `sandbox`. `closed-production-semantics-light.png` and `closed-production-semantics-dark.png` show the closed page that backend serves under production semantics.
- **Review:** `review-gpt-6.1-sol-round1.txt` and `review-gpt-6.1-sol-round2.txt`, both with no findings.
