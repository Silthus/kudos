import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { lookup } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { allowanceDay, allowanceLeft, weekOf } from "./allowance";
import { kudosTotals, type KudosTotals } from "./awards";

export type HomeFacts =
  | ({ kind: "member"; left: number; base: number; kudosEmoji: string } & KudosTotals)
  | { kind: "not-a-member" };

export const homeOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }): Promise<HomeFacts | null> => {
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
      ...(await kudosTotals(ctx, person.member, weekOf(today))),
    };
  },
});
