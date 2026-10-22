import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, workspaceDecision, type Flag } from "../analytics/flags";
import type { MemberId } from "./directory";
import { maintainerSettingsApplyTo } from "./workspaceSettings";

export const celebrationsSwitchFlag = { key: "celebrations-switch", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

type Switcher = { member: MemberId; admin: boolean };

export async function publicCelebrationsOn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  if (!(await workspaceDecision(ctx, celebrationsSwitchFlag, workspace))) return true;
  return storedSwitchOn(ctx, workspace);
}

export async function celebrationsSwitchShownTo(ctx: MutationCtx, workspace: string, person: Switcher): Promise<boolean | null> {
  if (!(await switchesCelebrations(ctx, workspace, person))) return null;
  return storedSwitchOn(ctx, workspace);
}

export async function celebrationsSwitchReadIn(ctx: QueryCtx, workspace: string): Promise<boolean | null> {
  if (!(await workspaceDecision(ctx, celebrationsSwitchFlag, workspace))) return null;
  return storedSwitchOn(ctx, workspace);
}

export async function setPublicCelebrations(ctx: MutationCtx, workspace: string, person: Switcher, on: boolean): Promise<boolean> {
  if (!(await switchesCelebrations(ctx, workspace, person))) return false;
  const stored = await switchIn(ctx, workspace);
  if ((stored?.on ?? true) === on) return false;
  if (stored === null) await ctx.db.insert("celebrationsSwitches", { workspace, on });
  else await ctx.db.patch(stored._id, { on });
  return true;
}

async function switchesCelebrations(ctx: MutationCtx, workspace: string, { member, admin }: Switcher) {
  if (!admin && !(await maintainerSettingsApplyTo(ctx, member))) return false;
  const applies = await workspaceDecision(ctx, celebrationsSwitchFlag, workspace);
  await exposed(ctx, celebrationsSwitchFlag, member, applies);
  return applies;
}

async function storedSwitchOn(ctx: QueryCtx, workspace: string) {
  return (await switchIn(ctx, workspace))?.on ?? true;
}

function switchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("celebrationsSwitches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
