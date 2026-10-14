import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { welcomedAsValidator, type WelcomeMessage } from "../feedback/welcome";
import { appHomeLink, appHomeUrl } from "./appHome";
import { mrkdwn, urlButtonOf } from "./blocks";
import { attemptArgs, sendOnce, slackLink, slackTextOf, tryAtMostThreeTimes } from "./delivery";

export const deliverWelcome = observedAction({
  args: { workspace: v.string(), user: v.string(), welcomed: v.optional(welcomedAsValidator), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...welcome }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, welcome);
        return sendOnce(ctx, welcome.workspace, "chat.postMessage", { channel: welcome.user, ...messageOf(message, welcome.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.deliverWelcome, { ...welcome, attempt: retry.attempt }),
    );
  },
});

function messageOf(welcome: WelcomeMessage, workspace: string) {
  return { text: textOf(welcome, workspace), blocks: [...greetingBlocksOf(welcome), allowanceBlockOf(welcome), ...websiteBlocksOf(welcome), buttonsBlockOf(welcome, workspace)] };
}

function textOf(welcome: WelcomeMessage, workspace: string) {
  const website = welcome.website === null ? [] : [welcome.website.line, slackLink(welcome.website.link)];
  return [slackTextOf(welcome.greeting), welcome.allowance, ...website, appHomeLink(workspace, welcome.openAppHome)].join("\n");
}

function greetingBlocksOf({ greeting }: WelcomeMessage) {
  return greeting.map((line) => sectionOf(slackTextOf([line])));
}

function allowanceBlockOf({ allowance }: WelcomeMessage) {
  return sectionOf(allowance);
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
