import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { welcomePickValidator, type WelcomeGroups, type WelcomeMessage } from "../feedback/welcome";
import { welcomedAsValidator } from "../welcome/welcomedAs";
import { appHomeLink, appHomeUrl } from "./appHomeLinks";
import { mrkdwn, plainText, urlButtonOf } from "./blocks";
import { attemptArgs, sendOnce, slackLink, slackTextOf, tryAtMostThreeTimes } from "./delivery";
import { groupSelectOf } from "./groupPicker";
import { encodeHomeAction } from "./interactivity";

const pickedGroupField = "group";

export const deliverWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), welcomed: v.optional(welcomedAsValidator), groups: v.optional(v.literal(true)), ...attemptArgs },
  handler: async (ctx, { attempt = 1, groups: groupsShown, ...welcome }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, welcome);
        const groups = groupsShown ? await ctx.runMutation(internal.feedback.welcome.welcomeGroupsOf, { workspace: welcome.workspace, user: welcome.user }) : null;
        return sendOnce(ctx, welcome.workspace, "chat.postMessage", { channel: welcome.user, ...messageOf(message, groups, welcome.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.deliverWelcome, { ...welcome, ...(groupsShown && { groups: groupsShown }), attempt: retry.attempt }),
    );
  },
});

export const updateWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), conversation: v.string(), message: v.string(), pick: welcomePickValidator, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...update }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const groups = await ctx.runMutation(internal.feedback.welcome.welcomeGroupsOf, { workspace: update.workspace, user: update.user, pick: update.pick });
        if (groups === null) return null;
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, { workspace: update.workspace, user: update.user });
        return sendOnce(ctx, update.workspace, "chat.update", { channel: update.conversation, ts: update.message, ...messageOf(message, groups, update.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.updateWelcome, { ...update, attempt: retry.attempt }),
    );
  },
});

function messageOf(welcome: WelcomeMessage, groups: WelcomeGroups | null, workspace: string) {
  return {
    text: textOf(welcome, groups, workspace),
    blocks: [...greetingBlocksOf(welcome), allowanceBlockOf(welcome), ...groupBlocksOf(groups), ...websiteBlocksOf(welcome), buttonsBlockOf(welcome, workspace)],
  };
}

function textOf(welcome: WelcomeMessage, groups: WelcomeGroups | null, workspace: string) {
  const website = welcome.website === null ? [] : [welcome.website.line, slackLink(welcome.website.link)];
  return [slackTextOf(welcome.greeting), welcome.allowance, ...(groups?.lines ?? []), ...website, appHomeLink(workspace, welcome.openAppHome)].join("\n");
}

function greetingBlocksOf({ greeting }: WelcomeMessage) {
  return greeting.map((line) => sectionOf(slackTextOf([line])));
}

function allowanceBlockOf({ allowance }: WelcomeMessage) {
  return sectionOf(allowance);
}

function groupBlocksOf(groups: WelcomeGroups | null) {
  if (groups === null) return [];
  const text = groups.lines.length === 0 ? [] : [sectionOf(groups.lines.join("\n"))];
  if (groups.picker === null) return text;
  const save = { type: "button", text: plainText("Save"), action_id: "save-primary-group", value: encodeHomeAction({ type: "pickPrimaryGroup", group: groups.picker.primary, surface: "welcome" }) };
  return [...text, { type: "actions", block_id: "primary-group", elements: [groupSelectOf(pickedGroupField, groups.picker.groups, groups.picker.primary), save] }];
}

function websiteBlocksOf({ website }: WelcomeMessage) {
  return website === null ? [] : [sectionOf(website.line)];
}

function buttonsBlockOf({ website, openAppHome }: WelcomeMessage, workspace: string) {
  const seeYourProgress = website === null ? [] : [{ ...urlButtonOf({ label: website.link.label, url: website.link.url, actionId: "welcome-website" }), style: "primary" }];
  const appHome = urlButtonOf({ label: openAppHome, url: appHomeUrl(workspace), actionId: "welcome-app-home" });
  return { type: "actions", elements: [...seeYourProgress, appHome] };
}

function sectionOf(text: string) {
  return { type: "section", text: mrkdwn(text) };
}
