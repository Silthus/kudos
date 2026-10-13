import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { kudosHomeOf, type KudosHome } from "../engine/home";
import { progressionHomeOf, type ProgressionHome } from "../progression/progression";
import { lookup } from "../workspace/directory";

export type HomeFacts = { kind: "member"; kudos: KudosHome; progression: ProgressionHome } | { kind: "not-a-member" };

export const homeOf = internalQuery({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }): Promise<HomeFacts | null> => {
    const person = await lookup(ctx, workspace, user);
    if (person === undefined) return null;
    if (person.kind !== "member") return { kind: "not-a-member" };
    return {
      kind: "member",
      kudos: await kudosHomeOf(ctx, workspace, person.member, person.timeZone),
      progression: await progressionHomeOf(ctx, person.member),
    };
  },
});
