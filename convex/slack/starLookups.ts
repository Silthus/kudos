import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { starReactionValidator } from "../stars/reaction";
import { giveStar } from "../stars/stars";
import { lookUpUser } from "./directory";
import { verificationTries } from "./verifyMember";

const firstRetryMs = 1000;

const lookUpArgs = { reaction: starReactionValidator, users: v.array(v.string()) };

type LookUpArgs = ObjectType<typeof lookUpArgs>;

export const lookUpStarPeople = observedAction({
  args: { ...lookUpArgs, attempt: v.optional(v.number()) },
  handler: async (ctx, { reaction, users, attempt = 1 }): Promise<void> => {
    const stillUnknown: string[] = [];
    let retryAfterMs = 0;
    for (const user of users) {
      const answer = await lookUpUser(ctx, reaction.workspace, user);
      if (answer.kind === "failed") {
        stillUnknown.push(user);
        retryAfterMs = Math.max(retryAfterMs, answer.retryAfterMs ?? 0);
      }
    }
    if (stillUnknown.length === 0) await ctx.runMutation(internal.slack.starLookups.decideLookedUpStar, { reaction });
    else if (attempt < verificationTries) await tryAgainLater(ctx, { reaction, users: stillUnknown, attempt }, retryAfterMs);
  },
});

async function tryAgainLater(ctx: ActionCtx, { attempt, ...lookUp }: LookUpArgs & { attempt: number }, retryAfterMs: number) {
  const waitMs = Math.max(retryAfterMs, firstRetryMs * 2 ** (attempt - 1));
  await ctx.scheduler.runAfter(waitMs, internal.slack.starLookups.lookUpStarPeople, { ...lookUp, attempt: attempt + 1 });
}

export const decideLookedUpStar = internalMutation({
  args: { reaction: starReactionValidator },
  handler: async (ctx, { reaction }): Promise<void> => {
    await giveStar(ctx, reaction);
  },
});
