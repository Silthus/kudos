import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import type { WelcomeGroups, WelcomeMessage } from "../feedback/welcome";
import { appHomeLink } from "./appHome";
import { mrkdwn, plainText } from "./blocks";
import { attemptArgs, sendOnce, slackLink, tryAtMostThreeTimes } from "./delivery";
import { groupSelectOf } from "./groupPicker";
import { encodeHomeAction } from "./interactivity";

const pickedGroupField = "group";

export const deliverWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...welcome }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, { workspace: welcome.workspace });
        const groups = await ctx.runMutation(internal.feedback.welcome.welcomeGroupsOf, welcome);
        return sendOnce(ctx, welcome.workspace, "chat.postMessage", { channel: welcome.user, ...messageOf(message, groups, welcome.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.deliverWelcome, { ...welcome, attempt: retry.attempt }),
    );
  },
});

export const updateWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), conversation: v.string(), message: v.string(), picked: v.id("userGroups"), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...update }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const groups = await ctx.runMutation(internal.feedback.welcome.welcomeGroupsOf, { workspace: update.workspace, user: update.user, picked: update.picked });
        if (groups === null) return null;
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, { workspace: update.workspace });
        return sendOnce(ctx, update.workspace, "chat.update", { channel: update.conversation, ts: update.message, ...messageOf(message, groups, update.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.updateWelcome, { ...update, attempt: retry.attempt }),
    );
  },
});

function messageOf(welcome: WelcomeMessage, groups: WelcomeGroups | null, workspace: string) {
  const website = welcome.website === null ? [] : [slackLink(welcome.website)];
  const links = [appHomeLink(workspace, welcome.openAppHome), ...website];
  if (groups === null) return { text: [...welcome.lines, ...links].join("\n") };
  return {
    text: [...welcome.lines, ...groups.lines, ...links].join("\n"),
    blocks: [sectionOf(welcome.lines), ...groupBlocksOf(groups), sectionOf(links)],
  };
}

function groupBlocksOf({ lines, picker }: WelcomeGroups) {
  const text = lines.length === 0 ? [] : [sectionOf(lines)];
  if (picker === null) return text;
  const save = { type: "button", text: plainText("Save"), action_id: "save-primary-group", value: encodeHomeAction({ type: "pickPrimaryGroup", group: picker.primary, surface: "welcome" }) };
  return [...text, { type: "actions", block_id: "primary-group", elements: [groupSelectOf(pickedGroupField, picker.groups, picker.primary), save] }];
}

function sectionOf(lines: string[]) {
  return { type: "section", text: mrkdwn(lines.join("\n")) };
}
