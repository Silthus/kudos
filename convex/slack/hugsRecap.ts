import { v } from "convex/values";
import type { RecapEmojiLine } from "../feedback/albumRecap";
import type { Recap, RecapLine } from "../hugs/recap";
import { settingsFooterText } from "./appHomeLinks";
import { mrkdwn } from "./blocks";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { attemptCall, isRefusedForItsBlocks, slackLink } from "./delivery";

const queuedBeforeTheMondayDmTookOver = { week: v.id("hugWeeks"), attempt: v.number() };

export const sendHugsRecap = observedAction({ args: queuedBeforeTheMondayDmTookOver, handler: async () => {} });

const mostPicturesInALine = 9;

export async function postRecap(ctx: ActionCtx, recap: Recap) {
  const words = { channel: recap.user, text: textOf(recap) };
  if (recap.emojiLine === null) return attemptCall(ctx, recap.workspace, "chat.postMessage", words);
  const sent = await attemptCall(ctx, recap.workspace, "chat.postMessage", { ...words, blocks: blocksOf(recap, recap.emojiLine) });
  return isRefusedForItsBlocks(sent) ? attemptCall(ctx, recap.workspace, "chat.postMessage", words) : sent;
}

function textOf({ lines, emojiLine, ...recap }: Recap) {
  return [...lines.map(lineTextOf), ...(emojiLine === null ? [] : [emojiLine.text]), ...footerOf(recap)].join("\n");
}

function blocksOf({ lines, ...recap }: Recap, emojiLine: RecapEmojiLine) {
  return [{ type: "section", text: mrkdwn(lines.map(lineTextOf).join("\n")) }, emojiLineBlockOf(emojiLine), ...footerOf(recap).map((footer) => ({ type: "context", elements: [mrkdwn(footer)] }))];
}

export function emojiLineBlockOf({ text, pictures }: RecapEmojiLine) {
  return { type: "context", elements: [...pictures.slice(0, mostPicturesInALine).map(({ url, name }) => ({ type: "image", image_url: url, alt_text: name })), mrkdwn(text)] };
}

export function footerOf({ workspace, footer }: Pick<Recap, "workspace" | "footer">) {
  return footer === null ? [] : [settingsFooterText(workspace, footer)];
}

export function lineTextOf(line: RecapLine) {
  return typeof line === "string" ? line : `${line.text}${slackLink(line.link)}`;
}
