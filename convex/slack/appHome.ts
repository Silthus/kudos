import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { renderHome, type HomeLine, type HomeView } from "../feedback/home";
import type { HomeFacts } from "../feedback/homes";
import { attemptArgs, failedAttempt, sendOnce, tryAtMostThreeTimes } from "./delivery";
import { lookUpUser } from "./directory";

export type HomeOpened = { type: "app_home_opened"; user: string; tab: "home" | "messages" };

export function isHomeTabOpened(event: { type: string }): event is HomeOpened {
  return event.type === "app_home_opened" && (event as HomeOpened).tab === "home";
}

export const publishHome = internalAction({
  args: { workspace: v.string(), user: v.string(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...opened }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const facts = await homeFactsOf(ctx, opened.workspace, opened.user);
        if (facts.kind === "unavailable") return failedAttempt(attempt, facts.retryAfterMs);
        return sendOnce(ctx, opened.workspace, "views.publish", { user_id: opened.user, view: homeView(renderHome(facts)) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.appHome.publishHome, { ...opened, attempt: retry.attempt }),
    );
  },
});

export function appHomeLink(workspace: string, label: string) {
  const query = new URLSearchParams({ team: workspace, id: appId(), tab: "home" });
  return `<slack://app?${query}|${label}>`;
}

type Unavailable = { kind: "unavailable"; retryAfterMs?: number };

async function homeFactsOf(ctx: ActionCtx, workspace: string, user: string): Promise<HomeFacts | Unavailable> {
  const known = await ctx.runQuery(internal.feedback.homes.homeOf, { workspace, user });
  if (known !== null) return known;
  const lookUp = await lookUpUser(ctx, workspace, user);
  if (lookUp.kind === "failed") return { kind: "unavailable", ...(lookUp.retryAfterMs !== undefined && { retryAfterMs: lookUp.retryAfterMs }) };
  return (await ctx.runQuery(internal.feedback.homes.homeOf, { workspace, user })) ?? { kind: "unavailable" };
}

function homeView({ title, tabs, groups }: HomeView) {
  const header = { type: "header", text: plainText(title) };
  const tabBar = tabs.length > 0 ? [tabBarOf(tabs)] : [];
  const body = groups.flatMap((group, index) => [...(index > 0 ? [divider] : []), ...group.map(blockOf)]);
  return { type: "home", blocks: [header, ...tabBar, ...body] };
}

function tabBarOf(tabs: HomeView["tabs"]) {
  return {
    type: "actions",
    elements: tabs.map(({ tab, label, current }) => ({
      type: "button",
      action_id: `tab:${tab}`,
      text: plainText(label),
      ...(current && { style: "primary" }),
    })),
  };
}

const divider = { type: "divider" };

function blockOf(line: HomeLine) {
  if (line.kind === "fields") return { type: "section", fields: line.fields.map(mrkdwn) };
  if (line.kind === "hint") return { type: "context", elements: [mrkdwn(line.text)] };
  return { type: "section", text: mrkdwn(line.text) };
}

function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

function plainText(text: string) {
  return { type: "plain_text", text };
}

function appId() {
  const id = process.env.SLACK_APP_ID;
  if (!id) throw new Error("SLACK_APP_ID is not set");
  return id;
}
