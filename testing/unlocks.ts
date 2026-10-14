import { expect } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { Feature } from "../convex/unlocks/feature";
import { openUnlock } from "../convex/unlocks/unlocks";
import type { Backend } from "./slackBackend";

export async function reachesLevel(t: Backend, member: Id<"members">, level: number, at = Date.now()) {
  const message = { workspace: "T1", conversation: "C1", message: `level-${level}-${member}` };
  const event = { type: "levelReached" as const, workspace: "T1", member, level, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, message, at };
  await t.mutation(internal.unlocks.unlocks.makeReady, { event });
}

export async function opens(t: Backend, member: Id<"members">, feature: Feature) {
  expect(await t.run((ctx) => openUnlock(ctx, member, feature))).toBe("done");
}
