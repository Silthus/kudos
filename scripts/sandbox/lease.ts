import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Owner = { branch: string; sha: string; worktree: string; thread?: string; pid: number; since: string };

export type Lease = { taken: true; release: () => void } | { taken: false; holder: Owner };

export function takeLease(stateDir: string, owner: Owner, isAlive: (pid: number) => boolean): Lease {
  mkdirSync(stateDir, { recursive: true });
  const path = leasePath(stateDir);
  if (claim(path, owner)) return { taken: true, release: () => releaseIfOwned(path, owner) };
  const holder = leaseHolder(stateDir);
  if (!holder) return takeLease(stateDir, owner, isAlive);
  if (isAlive(holder.pid)) return { taken: false, holder };
  releaseIfOwned(path, holder);
  return claim(path, owner) ? { taken: true, release: () => releaseIfOwned(path, owner) } : { taken: false, holder: leaseHolder(stateDir)! };
}

export function leaseHolder(stateDir: string): Owner | undefined {
  return readJson<Owner>(leasePath(stateDir));
}

export function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function claim(path: string, owner: Owner) {
  const draft = `${path}.${owner.pid}`;
  writeFileSync(draft, JSON.stringify(owner));
  try {
    linkSync(draft, path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    rmSync(draft, { force: true });
  }
}

function releaseIfOwned(path: string, owner: Owner) {
  const current = readJson<Owner>(path);
  if (current?.pid === owner.pid && current.since === owner.since) rmSync(path, { force: true });
}

const leasePath = (stateDir: string) => join(stateDir, "lease.json");
