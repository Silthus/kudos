import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type StepRun = { env?: Record<string, string>; git?: string };

export function runStep(script: string, { env = {}, git }: StepRun = {}) {
  const dir = mkdtempSync(join(tmpdir(), "workflow-step-"));
  const output = join(dir, "github-output");
  writeFileSync(output, "");
  if (git !== undefined) stubGit(dir, git);
  const { status } = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    env: { PATH: `${dir}:${process.env.PATH}`, GITHUB_OUTPUT: output, ...env },
    stdio: "ignore",
  });
  return { status, output: readFileSync(output, "utf8") };
}

function stubGit(dir: string, body: string) {
  writeFileSync(join(dir, "git"), `#!/bin/sh\n${body}\n`);
  chmodSync(join(dir, "git"), 0o755);
}
