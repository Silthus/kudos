#!/usr/bin/env bash
base=$1
for width in 1024 1280 1440 1536; do
  agent-browser set viewport $width 900 >/dev/null
  for path in "/book#me" "/book#hoggies" "/book#milestones" "/book#packs" "/activity" "/leaderboard" "/settings"; do
    agent-browser open "$base$path" >/dev/null
    agent-browser eval 'localStorage.setItem("hedgehug:quests-panel","folded")' >/dev/null
    agent-browser open "$base$path" >/dev/null
    agent-browser wait 800 >/dev/null
    echo "$width $path $(agent-browser eval "$(cat "$(dirname "$0")/measure.js")")"
  done
done
