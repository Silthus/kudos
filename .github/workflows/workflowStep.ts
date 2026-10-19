import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type StepRun = { env?: Record<string, string>; git?: string };

const githubDefaultShell = ["bash", "-e"];

export function runStep(script: string, { env = {}, git }: StepRun = {}) {
  const dir = mkdtempSync(join(tmpdir(), "workflow-step-"));
  try {
    const output = join(dir, "github-output");
    writeFileSync(output, "");
    if (git !== undefined) stubGit(dir, git);
    const [shell, ...flags] = githubDefaultShell;
    const { status, error } = spawnSync(shell!, [...flags, "-c", script], {
      env: { PATH: `${dir}:${process.env.PATH}`, GITHUB_OUTPUT: output, ...env },
      stdio: "ignore",
    });
    if (error) throw error;
    return { status, output: readFileSync(output, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function stubGit(dir: string, body: string) {
  writeFileSync(join(dir, "git"), `#!/bin/sh\n${body}\n`);
  chmodSync(join(dir, "git"), 0o755);
}
