import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { hoggieNamed, type Rarity } from "./catalogue";
import { tallyOf } from "./drops";

export type Pet = { person: MemberId; hoggie: string; name: string; rarity: Rarity };

export type PetOwner = { workspace: string; member: MemberId };

export async function makePetOf(ctx: MutationCtx, { workspace, member }: PetOwner, hoggie: string): Promise<string | null> {
  if (!(await owns(ctx, member, hoggie))) return null;
  const row = await petRowOf(ctx, workspace, member);
  if (row === null) await ctx.db.insert("petHoggies", { workspace, member, hoggie });
  else if (row.hoggie !== hoggie) await ctx.db.patch(row._id, { hoggie });
  return hoggie;
}

export async function petOf(ctx: QueryCtx, { workspace, member }: PetOwner): Promise<string | null> {
  return (await petRowOf(ctx, workspace, member))?.hoggie ?? null;
}

export async function petsIn(ctx: QueryCtx, workspace: string): Promise<Pet[]> {
  const rows = await ctx.db
    .query("petHoggies")
    .withIndex("by_workspace_member", (q) => q.eq("workspace", workspace))
    .collect();
  return rows.flatMap(petShownOf);
}

function petShownOf({ member, hoggie }: Doc<"petHoggies">): Pet[] {
  const entry = hoggieNamed(hoggie);
  return entry === undefined ? [] : [{ person: member, hoggie, name: entry.name, rarity: entry.rarity }];
}

async function owns(ctx: QueryCtx, member: MemberId, hoggie: string) {
  return hoggieNamed(hoggie) !== undefined && (await tallyOf(ctx, member, hoggie)) !== null;
}

function petRowOf(ctx: QueryCtx, workspace: string, member: MemberId): Promise<Doc<"petHoggies"> | null> {
  return ctx.db
    .query("petHoggies")
    .withIndex("by_workspace_member", (q) => q.eq("workspace", workspace).eq("member", member))
    .unique();
}
