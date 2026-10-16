#!/usr/bin/env bash
# usage: rig.sh <worktree> <label> <port> <site> <fake-port>
set -euo pipefail
B=~/.cache/convex/binaries/precompiled-2026-10-06-a3538c6/convex-local-backend
W=$1; label=$2; port=$3; site=$4; fake=$5
R=/tmp/i580/rig/rig-$label
name=kudos-i580-$label
for p in $port $site $fake; do
  if ss -ltn | grep -qE ":$p\b"; then echo "port $p taken" >&2; exit 1; fi
done
rm -rf "$R" && mkdir -p "$R/storage"
secret=$(openssl rand -hex 32)
key=$("$B" keygen admin-key --instance-name "$name" --instance-secret "$secret" 2>/dev/null | tail -1)
setsid nohup "$B" --instance-name "$name" --instance-secret "$secret" --port $port --site-proxy-port $site --local-storage "$R/storage" "$R/db.sqlite3" > "$R/backend.log" 2>&1 < /dev/null &
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$port/version" > /dev/null && break; sleep 1; done
printf 'CONVEX_SELF_HOSTED_URL=http://127.0.0.1:%s\nCONVEX_SELF_HOSTED_ADMIN_KEY=%s\n' $port "$key" > "$R/local.env"
chmod 600 "$R/local.env"
cd "$W"
cx() { timeout 300 npx --no -- convex "$@" --env-file "$R/local.env" < /dev/null; }
for pair in \
  SLACK_SIGNING_SECRET=test-signing-secret SLACK_BOT_TOKEN=xoxb-test SLACK_APP_ID=A_KUDOS SLACK_API_URL=http://127.0.0.1:$fake/api \
  POSTHOG_PROJECT_TOKEN=phc_test_project_token POSTHOG_PERSONAL_API_KEY=phs_test_flags_key POSTHOG_HOST=http://127.0.0.1:$fake \
  KUDOS_ENVIRONMENT=production SLACK_WORKSPACE_ID=T1 SITE_URL=https://kudos-site.test; do
  cx env set "${pair%%=*}" "${pair#*=}" > /dev/null
done
cx dev --once --typecheck disable > "$R/deploy.log" 2>&1
rm -f "$W/.env.local"
git -C "$W" checkout -q -- convex/_generated 2>/dev/null || true
printf '%s\n' '{"workspace":"T1","kudosEmoji":"hedgehug","baseAllowance":20}' > "$R/workspaces.jsonl"
cx import --table workspaces --append -y "$R/workspaces.jsonl" > /dev/null 2>&1
echo "backend $label $(ss -ltnp | grep -E ":$port\b" | grep -oE 'pid=[0-9]+' | head -1) on $port/$site from $(git -C "$W" rev-parse --short HEAD)"
