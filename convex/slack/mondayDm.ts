import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import type { MondayDm, MondayQuests } from "../mondayDm/mondayDm";
import type { ChecklistItem } from "../mondayDm/questsCopy";
import type { HugsSection } from "../hugs/recap";
import { mrkdwn, plainText, urlButtonOf } from "./blocks";
import { attemptCall, isRateLimited, retryAfter, type Attempt } from "./delivery";
import { emojiLineBlockOf, footerOf, lineTextOf, postRecap } from "./hugsRecap";

const triesAtMost = 3;
const marks: Record<ChecklistItem["mark"], { type: "emoji"; name: string; skin_tone?: number }> = {
  done: { type: "emoji", name: "white_check_mark" },
  next: { type: "emoji", name: "point_right", skin_tone: 2 },
  open: { type: "emoji", name: "white_circle" },
};

export const sendMondayDm = observedAction({
  args: { dm: v.id("mondayDms"), attempt: v.number() },
  handler: async (ctx, { dm, attempt }) => {
    const message = await ctx.runMutation(internal.mondayDm.mondayDm.startMondayDm, { dm, attempt });
    if (message === null) return;
    const sent = await postMondayDm(ctx, message);
    if (isRateLimited(sent) && attempt < triesAtMost) {
      await ctx.runMutation(internal.mondayDm.mondayDm.mondayDmLater, { dm, attempt, retry: retryAfter(sent, attempt)! });
      return;
    }
    await ctx.runMutation(internal.mondayDm.mondayDm.mondayDmEnded, { dm, attempt, outcome: outcomeOf(sent) });
  },
});

function postMondayDm(ctx: ActionCtx, dm: MondayDm): Promise<Attempt> {
  const { workspace, user, hugs, quests, footer } = dm;
  if (quests === null) return postRecap(ctx, { workspace, user, lines: [...hugs!.lines, ...hugs!.closing], emojiLine: hugs!.emojiLine, footer });
  return attemptCall(ctx, workspace, "chat.postMessage", { channel: user, text: textOf(hugs, quests), blocks: blocksOf(dm, quests) });
}

function outcomeOf(sent: Attempt): "delivered" | "gone" | "failed" {
  return sent.kind === "delivered" || sent.kind === "gone" ? sent.kind : "failed";
}

function textOf(hugs: HugsSection | null, quests: MondayQuests) {
  return [...(hugs?.lines.map(lineTextOf) ?? []), quests.heading].join("\n");
}

function blocksOf({ workspace, hugs, footer }: MondayDm, quests: MondayQuests) {
  return [
    ...(hugs === null ? [] : hugsBlocksOf(hugs)),
    { type: "section", text: mrkdwn(quests.heading) },
    checklistBlockOf(quests.checklist),
    { type: "actions", elements: buttonsOf(quests) },
    ...footerOf({ workspace, footer }).map((text) => ({ type: "context", elements: [mrkdwn(text)] })),
  ];
}

function hugsBlocksOf({ lines, emojiLine }: HugsSection) {
  return [{ type: "section", text: mrkdwn(lines.map(lineTextOf).join("\n")) }, ...(emojiLine === null ? [] : [emojiLineBlockOf(emojiLine)]), { type: "divider" }];
}

function checklistBlockOf(checklist: ChecklistItem[]) {
  return { type: "rich_text", elements: [{ type: "rich_text_list", style: "bullet", indent: 0, elements: checklist.map(checklistItemOf) }] };
}

function checklistItemOf({ goal, mark, progress }: ChecklistItem) {
  const goalText = { type: "text", text: ` ${goal}`, style: { bold: mark === "next", strike: mark === "done" } };
  const progressText = progress === null ? [] : [{ type: "text", text: `  ${progress}`, style: { italic: true } }];
  return { type: "rich_text_section", elements: [marks[mark], goalText, ...progressText] };
}

function buttonsOf({ waiting, links }: MondayQuests) {
  const identify = waiting && links !== null ? [{ ...urlButtonOf({ label: "Identify them on the website", url: links.book, actionId: "dm-link:monday:book" }), style: "primary" }] : [];
  const seeQuests = links === null ? [] : [urlButtonOf({ label: "See your quests", url: links.quests, actionId: "dm-link:monday:quests" })];
  return [...identify, ...seeQuests, { type: "button", text: plainText("Stop Monday quests"), action_id: "monday-dm:stop" }];
}
