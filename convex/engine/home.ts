import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { lookup, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { allowanceDay, allowanceLeft, nextAllowanceDayStart, weekOf } from "./allowance";
import { weekTotals, type WeekTotals } from "./awards";
import { lifetimeTotals, type LifetimeTotals } from "./totals";

export type KudosHome = { left: number; base: number; kudosEmoji: string; refillsAt: number } & WeekTotals & LifetimeTotals;

export type HomeFacts = ({ kind: "member" } & KudosHome) | { kind: "not-a-member" };

export const homeOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: (ctx, { workspace, user }) => homeFacts(ctx, workspace, user),
});

export async function homeFacts(ctx: QueryCtx, workspace: string, user: string): Promise<HomeFacts | null> {
  const person = await lookup(ctx, workspace, user);
  if (person === undefined) return null;
  if (person.kind !== "member") return { kind: "not-a-member" };
  return { kind: "member", ...(await kudosHomeOf(ctx, workspace, person.member, person.timeZone)) };
}

export async function kudosHomeOf(ctx: QueryCtx, workspace: string, member: MemberId, timeZone: string | undefined): Promise<KudosHome> {
  const { baseAllowance, kudosEmoji } = await settingsOf(ctx, workspace);
  const now = Date.now();
  const today = allowanceDay(now, timeZone);
  return {
    left: await allowanceLeft(ctx, member, today, baseAllowance),
    base: baseAllowance,
    kudosEmoji,
    refillsAt: nextAllowanceDayStart(now, timeZone),
    ...(await weekTotals(ctx, member, weekOf(today))),
    ...(await lifetimeTotals(ctx, member)),
  };
}
