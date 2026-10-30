#!/usr/bin/env bash
# Appends a users and an authSessions row for one synthetic member and prints the identity for `convex run --identity`.
set -euo pipefail
user="$1" name="$2" workspace="$KUDOS_WORKSPACE" site="$KUDOS_SITE"
scratch=$(mktemp -d)
convex() { timeout 120 npx --no -- convex "$@"; }
idOf() { convex data "$1" --limit 500 --format jsonLines | grep -F "$2" | head -1 | sed -E 's/.*"_id": "([^"]+)".*/\1/'; }

printf '{"chatIdentity":{"workspace":"%s","user":"%s"},"name":"%s","givenName":"%s"}\n' "$workspace" "$user" "$name" "${name%% *}" >"$scratch/users.jsonl"
convex import --table users --append -y --format jsonLines "$scratch/users.jsonl" >/dev/null
userId=$(idOf users "\"user\": \"$user\"")
expires=$(( $(date +%s) * 1000 + 4 * 3600 * 1000 ))
printf '{"userId":"%s","expirationTime":%s}\n' "$userId" "$expires" >"$scratch/authSessions.jsonl"
convex import --table authSessions --append -y --format jsonLines "$scratch/authSessions.jsonl" >/dev/null
sessionId=$(idOf authSessions "\"userId\": \"$userId\"")
printf '{"subject":"%s|%s","issuer":"%s"}\n' "$userId" "$sessionId" "$site"
