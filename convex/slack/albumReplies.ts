import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { thoughtfulPacksGrantedEventValidator, type ThoughtfulPacksGrantedEvent } from "../bus/events";
import type { AlbumReply, AlbumReplyButton, AlbumReplyDestination, AlbumReplyRecipient } from "../feedback/albumReplies";
import { escaped, mrkdwn, urlButtonOf } from "./blocks";
import { attemptArgs, attemptCall, isRateLimited, isRefusedAsEphemeral, isRefusedForItsBlocks, retryAfter, slackTextOf, tryAtMostThreeTimes, type Attempt, type Retry } from "./delivery";


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
  const result = await postBesideOrAsDirectMessage(ctx, reply);
  return isRefusedForItsBlocks(result) && hasPictures(reply) ? postBesideOrAsDirectMessage(ctx, withoutPictures(reply)) : result;
}

async function postBesideOrAsDirectMessage(ctx: ActionCtx, reply: AlbumReply): Promise<Attempt> {
  const { destination } = reply;
  if (destination.kind === "dm") return postAsDirectMessage(ctx, reply, destination);
  const ephemeral = { channel: destination.conversation, user: destination.user, ...(destination.threadRoot !== undefined && { thread_ts: destination.threadRoot }), ...contentOf(reply) };
  const result = await attemptCall(ctx, reply.workspace, "chat.postEphemeral", ephemeral);
  return isRefusedAsEphemeral(result) ? postAsDirectMessage(ctx, reply, destination) : result;
}

function postAsDirectMessage(ctx: ActionCtx, reply: AlbumReply, { user }: AlbumReplyDestination): Promise<Attempt> {
  return attemptCall(ctx, reply.workspace, "chat.postMessage", { channel: user, ...contentOf(reply), unfurl_links: false, unfurl_media: false });
}

function hasPictures({ recipients }: AlbumReply) {
  return recipients.some(({ hype }) => hype?.picture);
}

function withoutPictures(reply: AlbumReply): AlbumReply {
  return { ...reply, recipients: reply.recipients.map((recipient) => (recipient.hype === null ? recipient : { ...recipient, hype: { ...recipient.hype, picture: null } })) };
}

function contentOf(reply: AlbumReply) {
  return { text: fallbackTextOf(reply), blocks: blocksOf(reply) };
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
