#!/usr/bin/env bash
# The live run on the sandbox: signed Slack events in, the website's own mutations as Drew, kudos messages, awards and hugs read back.
# Needs KUDOS_SITE, KUDOS_WORKSPACE, SLACK_SIGNING_SECRET_FILE and Drew's identity from sign-in.sh in DREW_IDENTITY.
# Usage: live-run.sh picks <earned name> <hype name> <hype id> <first thank-you name>
#        live-run.sh hype <earned name> <hype name> <hype id> <first thank-you name> <Blake's sticker and hoggie item ids>...
set -euo pipefail
here=$(dirname "$0")
phase="$1" earned="$2" hype="$3" hypeId="$4" firstThankYou="$5"
shift 5
convex() { timeout 120 npx --no -- convex "$@"; }
drive() { bun "$here/drive.mts" "$1" "$earned" "$hype" "$firstThankYou"; }
asDrew() { echo "> $1 $2"; convex run "website/album:$1" "$2" --identity "$DREW_IDENTITY"; }
proofRows() {
  sleep 8
  echo "kudos messages in the proof channel (message ts, state, emoji):"
  convex data kudosMessages --limit 40 --format jsonLines | grep -F C0PRFPICKS1 | sed -E 's/.*"emoji": \[([^]]*)\].*"message": "([^"]+)".*"state": "([^"]+)".*/  \2  \3  \1/' | sort
  echo "awards in the proof channel (message ts, giver -> recipient):"
  convex data awards --limit 40 --format jsonLines | grep -F C0PRFPICKS1 | sed -E 's/.*"giver": "([^"]+)".*"message": "([^"]+)".*"recipient": "([^"]+)".*/  \2  \1 -> \3/' | sort
  echo "hugs in the proof channel (message ts, emoji):"
  convex data hugs --limit 40 --format jsonLines | grep -F C0PRFPICKS1 | sed -E 's/.*"emoji": "([^"]+)".*"message": "([^"]+)".*/  \2  :\1:/' | sort || true
}

if [ "$phase" = picks ]; then
  echo "## Nothing picked yet"
  drive unpicked
  proofRows
  echo; echo "## Drew picks :$earned: on the website"
  asDrew pickKudosEmoji '{"emoji":"level:2","picked":true}'
  drive picked
  proofRows
  echo; echo "## Drew unpicks it"
  asDrew pickKudosEmoji '{"emoji":"level:2","picked":false}'
  drive unpicked-again
  proofRows
elif [ "$phase" = hype ]; then
  echo "## Drew turns Blake's sticker and its hoggie over, so Blake's hype emoji is Drew's"
  for item in "$@"; do asDrew turnItem "{\"item\":\"$item\"}" | grep -m1 '"kind"'; done
  asDrew markEmojisSeen "{\"ids\":[\"$hypeId\"]}"
  drive hype
  proofRows
else
  echo "phase is picks or hype" >&2
  exit 1
fi
