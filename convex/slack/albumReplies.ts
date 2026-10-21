import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { thoughtfulPacksGrantedEventValidator, type ThoughtfulPacksGrantedEvent } from "../bus/events";
import type { AlbumReply, AlbumReplyButton, AlbumReplyRecipient } from "../feedback/albumReplies";
import { escaped, mrkdwn, urlButtonOf } from "./blocks";
import { attemptArgs, attemptCall, isRateLimited, isRefusedForItsBlocks, retryAfter, slackTextOf, tryAtMostThreeTimes, type Attempt, type Retry } from "./delivery";


export const deliverAlbumReply = observedAction({
  args: { event: thoughtfulPacksGrantedEventValidator, ...attemptArgs },
  handler: async (ctx, { event, attempt = 1 }) => {
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => sendAlbumReply(ctx, event, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.albumReplies.deliverAlbumReply, { event, attempt: retry.attempt }),
    );
  },
});

async function sendAlbumReply(ctx: ActionCtx, event: ThoughtfulPacksGrantedEvent, attempt: number): Promise<Retry> {
  const reply = await ctx.runQuery(internal.feedback.albumReplies.albumReply, { event });
  if (reply === null) return null;
  const result = await postAlbumReply(ctx, reply);
  return isRateLimited(result) ? retryAfter(result, attempt) : null;
}

async function postAlbumReply(ctx: ActionCtx, reply: AlbumReply): Promise<Attempt> {
  const result = await attemptCall(ctx, reply.workspace, "chat.postMessage", messageOf(reply));
  return isRefusedForItsBlocks(result) && hasPictures(reply) ? attemptCall(ctx, reply.workspace, "chat.postMessage", messageOf(withoutPictures(reply))) : result;
}

function hasPictures({ recipients }: AlbumReply) {
  return recipients.some(({ hype }) => hype?.picture);
}

function withoutPictures(reply: AlbumReply): AlbumReply {
  return { ...reply, recipients: reply.recipients.map((recipient) => (recipient.hype === null ? recipient : { ...recipient, hype: { ...recipient.hype, picture: null } })) };
}

function messageOf(reply: AlbumReply) {
  const { destination } = reply;
  const where = destination.kind === "thread" ? { channel: destination.conversation, thread_ts: destination.threadTs } : { channel: destination.user };
  return { ...where, text: fallbackTextOf(reply), blocks: blocksOf(reply), unfurl_links: false, unfurl_media: false };
}

function fallbackTextOf({ recipients }: AlbumReply) {
  return recipients.map(({ headline }) => escaped(headline)).join(" · ");
}

function blocksOf({ recipients, more, waiting, buttons, gains }: AlbumReply) {
  return [
    ...recipients.flatMap(recipientBlocksOf),
    ...(more > 0 ? [{ type: "context", elements: [mrkdwn(`And ${more} more.`)] }] : []),
    ...(waiting === null ? [] : [{ type: "context", elements: [mrkdwn(escaped(waiting))] }]),
    ...(buttons.length > 0 ? [{ type: "actions", elements: buttons.map(buttonOf) }] : []),
    ...(gains === null ? [] : [{ type: "context", elements: [mrkdwn(slackTextOf([gains]))] }]),
  ];
}

function recipientBlocksOf({ headline, lines, hype }: AlbumReplyRecipient) {
  const words = { type: "section", text: mrkdwn([`*${escaped(headline)}*`, ...lines.map(escaped)].join("\n")) };
  if (hype === null) return [words];
  const picture = hype.picture === null ? [] : [{ type: "image", image_url: hype.picture.url, alt_text: hype.picture.label }];
  return [words, { type: "context", elements: [...picture, mrkdwn(escaped(hype.line))] }];
}

function buttonOf({ label, url, id }: AlbumReplyButton) {
  return urlButtonOf({ label, url, actionId: id });
}
