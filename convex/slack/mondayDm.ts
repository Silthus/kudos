import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import type { Id } from "../_generated/dataModel";
import type { MondayDm, MondayQuests } from "../mondayDm/mondayDm";
import type { MondayDmContent } from "../mondayDm/records";
import type { HugsSection } from "../hugs/recap";
import type { MondayWelcome } from "../welcome/mondayWelcome";
import { buttonOf, mrkdwn, urlButtonOf } from "./blocks";
import { checklistBlockOf } from "./checklist";
import { attemptArgs, attemptCall, isRateLimited, retryAfter, sendOnce, tryAtMostThreeTimes, type Attempt } from "./delivery";
import { emojiLineBlockOf, footerOf, lineTextOf, postRecap } from "./hugsRecap";
import { mondayWelcomeMessageOf } from "./welcome";

const triesAtMost = 3;

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

export const showMondayDm = observedAction({
  args: { dm: v.id("mondayDms"), channel: v.string(), ts: v.string(), ...attemptArgs },
  handler: async (ctx, { dm, channel, ts, attempt = 1 }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const shown = await ctx.runQuery(internal.mondayDm.stop.shownMondayDm, { dm });
        if (shown?.content.quests == null) return null;
        const message = shown.stopped ? stoppedMessageOf(dm, shown.workspace, shown.content) : messageOf({ dm, workspace: shown.workspace, ...shown.content }, shown.content.quests);
        return sendOnce(ctx, shown.workspace, "chat.update", { channel, ts, ...message }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.mondayDm.showMondayDm, { dm, channel, ts, attempt: retry.attempt }),
    );
  },
});

function postMondayDm(ctx: ActionCtx, dm: MondayDm): Promise<Attempt> {
  const { workspace, user, hugs, quests, footer, catchUp } = dm;
  if (catchUp !== null) return attemptCall(ctx, workspace, "chat.postMessage", { channel: user, ...catchUpMessageOf(dm, catchUp) });
  if (quests === null) return postRecap(ctx, { workspace, user, lines: [...hugs!.lines, ...hugs!.closing], emojiLine: hugs!.emojiLine, footer });
  return attemptCall(ctx, workspace, "chat.postMessage", { channel: user, ...messageOf(dm, quests) });
}

function messageOf(dm: Omit<MondayDm, "user" | "catchUp">, quests: MondayQuests) {
  return { text: textOf(dm.hugs, quests), blocks: blocksOf(dm, quests) };
}

function catchUpMessageOf({ workspace, user, hugs, footer }: MondayDm, catchUp: MondayWelcome) {
  const welcome = mondayWelcomeMessageOf(catchUp, user);
  return {
    ...welcome,
    text: [...(hugs?.lines.map(lineTextOf) ?? []), welcome.text].join("\n"),
    blocks: [...(hugs === null ? [] : hugsBlocksOf(hugs)), ...welcome.blocks, ...footerBlocksOf(workspace, footer)],
  };
}

function stoppedMessageOf(dm: Id<"mondayDms">, workspace: string, { hugs, footer }: MondayDmContent) {
  const note = `🔕 *Done, no more Monday quests from me.*${hugs === null ? "" : " Your hugs recap still comes on Mondays."} Changed your mind? One press brings them back.`;
  return {
    text: [...(hugs?.lines.map(lineTextOf) ?? []), note].join("\n"),
    blocks: [
      ...(hugs === null ? [] : hugsBlocksOf(hugs)),
      { type: "section", text: mrkdwn(note) },
      { type: "actions", elements: [buttonOf({ label: "Turn Monday quests back on", command: { type: "resumeMondayQuests", dm } })] },
      ...footerBlocksOf(workspace, footer),
    ],
  };
}

function outcomeOf(sent: Attempt): "delivered" | "gone" | "failed" {
  return sent.kind === "delivered" || sent.kind === "gone" ? sent.kind : "failed";
}

function textOf(hugs: HugsSection | null, quests: MondayQuests) {
  return [...(hugs?.lines.map(lineTextOf) ?? []), quests.heading].join("\n");
}

function blocksOf({ dm, workspace, hugs, footer }: Omit<MondayDm, "user" | "catchUp">, quests: MondayQuests) {
  return [
    ...(hugs === null ? [] : hugsBlocksOf(hugs)),
    { type: "section", text: mrkdwn(quests.heading) },
    checklistBlockOf(quests.checklist),
    { type: "actions", elements: buttonsOf(dm, quests) },
    ...footerBlocksOf(workspace, footer),
  ];
}

function footerBlocksOf(workspace: string, footer: MondayDmContent["footer"]) {
  return footerOf({ workspace, footer }).map((text) => ({ type: "context", elements: [mrkdwn(text)] }));
}

function hugsBlocksOf({ lines, emojiLine }: HugsSection) {
  return [{ type: "section", text: mrkdwn(lines.map(lineTextOf).join("\n")) }, ...(emojiLine === null ? [] : [emojiLineBlockOf(emojiLine)]), { type: "divider" }];
}

function buttonsOf(dm: Id<"mondayDms">, { waiting, links }: MondayQuests) {
  const identify = waiting && links !== null ? [{ ...urlButtonOf({ label: "Identify them on the website", url: links.book, actionId: "dm-link:monday:book" }), style: "primary" }] : [];
  const seeQuests = links === null ? [] : [urlButtonOf({ label: "See your quests", url: links.quests, actionId: "dm-link:monday:quests" })];
  return [...identify, ...seeQuests, buttonOf({ label: "Stop Monday quests", command: { type: "stopMondayQuests", dm } })];
}
