import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { lookup } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { allowanceDay, allowanceLeft, weekOf } from "./allowance";
import { weekTotals, type WeekTotals } from "./awards";
import { lifetimeTotals, type LifetimeTotals } from "./totals";

export type HomeFacts =
  | ({ kind: "member"; left: number; base: number; kudosEmoji: string } & WeekTotals & LifetimeTotals)
  | { kind: "not-a-member" };

export const homeOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: (ctx, { workspace, user }) => homeFacts(ctx, workspace, user),
});

export async function homeFacts(ctx: QueryCtx, workspace: string, user: string): Promise<HomeFacts | null> {
  const person = await lookup(ctx, workspace, user);
  if (person === undefined) return null;
  if (person.kind !== "member") return { kind: "not-a-member" };

  const { baseAllowance, kudosEmoji } = await settingsOf(ctx, workspace);
  const today = allowanceDay(Date.now(), person.timeZone);
  return {
    kind: "member",
    left: await allowanceLeft(ctx, person.member, today, baseAllowance),
    base: baseAllowance,
    kudosEmoji,
    ...(await weekTotals(ctx, person.member, weekOf(today))),
    ...(await lifetimeTotals(ctx, person.member)),
  };
}
