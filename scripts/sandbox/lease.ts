import { dlopen, FFIType } from "bun:ffi";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Leases, Owner } from "./deploy";

const exclusive = 2;
const nonBlocking = 4;
const unlock = 8;
const libc = dlopen("libc.so.6", { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } });

export type KernelLeases = Leases & { descriptor(): number | undefined };

export function kernelLeases(stateDir: string): KernelLeases {
  mkdirSync(stateDir, { recursive: true });
  const lockPath = join(stateDir, "lease.lock");
  const ownerPath = join(stateDir, "lease.json");
  let held: number | undefined;
  const tryLock = () => {
    const descriptor = openSync(lockPath, "a");
    if (libc.symbols.flock(descriptor, exclusive | nonBlocking) === 0) return descriptor;
    closeSync(descriptor);
    return undefined;
  };
  const owner = () => {
    try {
      return JSON.parse(readFileSync(ownerPath, "utf8")) as Owner;
    } catch {
      return undefined;
    }
  };
  return {
    take(next) {
      const descriptor = tryLock();
      if (descriptor === undefined) return { holder: owner() };
      writeFileSync(ownerPath, JSON.stringify(next));
      held = descriptor;
      return {
        release() {
          rmSync(ownerPath, { force: true });
          closeSync(descriptor);
          held = undefined;
        },
      };
    },
    holder() {
      const descriptor = tryLock();
      if (descriptor === undefined) return owner() ?? { branch: "an unrecorded deploy", sha: "unknown", worktree: "unknown", since: "unknown" };
      libc.symbols.flock(descriptor, unlock);
      closeSync(descriptor);
      return undefined;
    },
    descriptor: () => held,
  };
}
