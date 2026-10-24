#!/usr/bin/env bash
set -euo pipefail

lock_dir="${GATE_LANE_LOCK_DIR:-/tmp/kudos-gate-lane}"
slots=2

take_a_gate_slot() {
  mkdir -p "$lock_dir"
  local announced=""
  while true; do
    for slot in $(seq 1 "$slots"); do
      exec {slot_fd}>"$lock_dir/slot-$slot.lock"
      flock --nonblock "$slot_fd" && return
      exec {slot_fd}>&-
    done
    [ -n "$announced" ] || echo "gate:lane waits for one of the $slots lanes gating on this box to finish" >&2
    announced=yes
    sleep 1
  done
}

workers_per_slot() {
  local workers=$(($(nproc) / slots))
  echo $((workers > 0 ? workers : 1))
}

take_a_gate_slot
pnpm test:guards
pnpm typecheck
pnpm test --changed origin/main --project '!guards' --maxWorkers="$(workers_per_slot)"
pnpm coherence
