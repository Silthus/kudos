#!/usr/bin/env bash
# Typecheck each proof fixture as it builds: copied into website/ beside src/.
cd "$1"
status=0
for dir in proof/*/fixture; do
  name=$(basename "$(dirname "$dir")")
  cp "$dir/proof-fixture.tsx" "proof-fixture-$name.tsx"
  printf '{"extends":"./tsconfig.json","include":["src","proof-fixture-%s.tsx"]}' "$name" > tsconfig.fixture.json
  echo "== $name"
  npx --no -- tsc --noEmit -p tsconfig.fixture.json 2>&1 | grep "proof-fixture" || echo "typechecks"
  npx --no -- tsc --noEmit -p tsconfig.fixture.json >/dev/null 2>&1 || status=1
  rm -f "proof-fixture-$name.tsx" tsconfig.fixture.json
done
exit $status
