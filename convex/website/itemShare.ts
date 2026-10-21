import { v } from "convex/values";
import { albumShownTo } from "../album/flag";
import { shareWin, type ShareOffers } from "../items/share";
import { memberMutation } from "./memberMutation";

export type { ShareOffers };

export type ShareAnswer = { kind: "shared" } | { kind: "refused" };

export const shareItem = memberMutation({
  args: { item: v.id("items") },
  handler: async (ctx, me, _person, { item }): Promise<ShareAnswer> => ((await albumShownTo(ctx, me.member)) && (await shareWin(ctx, me, item, Date.now())) ? { kind: "shared" } : { kind: "refused" }),
});
