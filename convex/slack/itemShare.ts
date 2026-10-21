import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import type { ShareCard } from "../items/share";
import { escaped, mrkdwn, urlButtonOf } from "./blocks";
import { attemptArgs, attemptCall, isRateLimited, isRefusedForItsBlocks, retryAfter, tryAtMostThreeTimes, type Retry } from "./delivery";
import { mrkdwnOf, plainOf } from "./mondayPost";

export const postItemShare = observedAction({
  args: { share: v.id("itemShares"), ...attemptArgs },
  handler: async (ctx, { share, attempt = 1 }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const card = await ctx.runQuery(internal.items.share.shareCardOf, { share });
        return card === null ? null : postAtMostOnce(ctx, card, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.itemShare.postItemShare, { share, attempt: retry.attempt }),
    );
  },
});

async function postAtMostOnce(ctx: ActionCtx, card: ShareCard, attempt: number): Promise<Retry> {
  const sent = await attemptCall(ctx, card.workspace, "chat.postMessage", messageOf(card));
  const settled = isRefusedForItsBlocks(sent) && card.picture !== null ? await attemptCall(ctx, card.workspace, "chat.postMessage", messageOf({ ...card, picture: null })) : sent;
  return isRateLimited(settled) ? retryAfter(settled, attempt) : null;
}

function messageOf({ channel, lead, picture, album }: ShareCard) {
  const accessory = picture === null ? {} : { accessory: { type: "image", image_url: picture.url, alt_text: picture.label } };
  const link = album === null ? [] : [{ type: "actions", elements: [urlButtonOf({ label: "Open HedgeHug", url: album, actionId: "item-share-open" })] }];
  return { channel, text: escaped(plainOf(lead)), blocks: [{ type: "section", text: mrkdwn(mrkdwnOf(lead)), ...accessory }, ...link], unfurl_links: false, unfurl_media: false };
}
