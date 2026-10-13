# The sign-in handshake test

`signIn.handshake.ts` drives the real Convex Auth Slack handshake against `mockSlackIssuer.ts`, a stand-in for Slack's OpenID Connect issuer, `users.info` and PostHog's flag definitions on `127.0.0.1:3412` (`MOCK_SLACK_PORT`). It runs on a disposable local backend on its own ports, never the shared `3210` and never a cloud deployment.

1. Start `~/.cache/convex/binaries/<version>/convex-local-backend` with its own `--instance-name`, `--port`, `--site-proxy-port` and `--local-storage` under `/tmp`, and write an env file with `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`.
2. Set the backend's env with `npx --no -- convex env set --env-file <file>`: `SLACK_WORKSPACE_ID=TALLOWED`, `SLACK_OIDC_ISSUER`, `POSTHOG_HOST` and `SLACK_API_URL` (with `/api`) pointing at the mock, `AUTH_SLACK_ID=mock-client`, `AUTH_SLACK_SECRET=mock-client-secret`, `SITE_URL` (the backend's site URL), fresh `JWT_PRIVATE_KEY` and `JWKS`, and placeholder `POSTHOG_PROJECT_TOKEN`, `POSTHOG_PERSONAL_API_KEY`, `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`.
3. Deploy: `npx --no -- convex dev --once --env-file <file>`.
4. Run: `HANDSHAKE_ENV_FILE=<file> HANDSHAKE_SITE_URL=<site URL> pnpm test:handshake`.

The mock serves the `website` flag on unless the test switches it, so the flag is only ever on for that disposable backend. To click through the site by hand, upload a build with `npx --no -- static-hosting upload --dist website/dist` and run `node testing/handshake/serveMockSlack.ts`; `POST /control/next` picks who signs in next and `POST /control/website` switches the flag, followed by `npx --no -- convex run --component posthog lib:refreshFlagDefinitions`.
