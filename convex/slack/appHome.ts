import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { recordUsage, recordUsageWithoutBlocking } from "../analytics/usage";
import { renderHome, type HomeAction, type HomeLine, type HomeView } from "../feedback/home";
import { stampOf, type HomeFacts } from "../feedback/homes";
import { lookup } from "../workspace/directory";
import { attemptArgs, failedAttempt, sendOnce, tryAtMostThreeTimes } from "./delivery";
import { lookUpUser, refreshUser } from "./directory";

export type HomeOpened = { type: "app_home_opened"; user: string; tab: "home" | "messages" };

export function isHomeTabOpened(event: { type: string }): event is HomeOpened {
  return event.type === "app_home_opened" && (event as HomeOpened).tab === "home";
}

type Opening = { workspace: string; user: string; at: number };

export async function reportHomeOpened(ctx: MutationCtx, { workspace, user, at }: Opening): Promise<"reported" | "unknown-person"> {
  const person = await lookup(ctx, workspace, user);
  if (person === undefined) return "unknown-person";
  if (person.kind === "member") await recordUsage(ctx, { kind: "appHomeOpened", workspace, member: person.member, at });
  return "reported";
}

export const reportLookedUpHomeOpening = internalMutation({
  args: { workspace: v.string(), user: v.string(), at: v.number() },
  handler: async (ctx, opening) => {
    await reportHomeOpened(ctx, opening);
  },
});

export const publishHome = observedAction({
  args: { workspace: v.string(), user: v.string(), opened: v.optional(v.boolean()), unreportedOpeningAt: v.optional(v.number()), ...attemptArgs },
  handler: async (ctx, { attempt = 1, unreportedOpeningAt, ...home }) => {
    let unreported = unreportedOpeningAt;
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const facts = await homeFactsOf(ctx, home);
        if (facts.kind === "unavailable") return failedAttempt(attempt, facts.retryAfterMs);
        if (unreported !== undefined) {
          const at = unreported;
          await recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.appHome.reportLookedUpHomeOpening, { workspace: home.workspace, user: home.user, at }));
          unreported = undefined;
        }
        const retry = await sendOnce(ctx, home.workspace, "views.publish", { user_id: home.user, view: homeView(renderHome(facts)) }, attempt);
        if (retry !== null) return retry;
        return (await isLatest(ctx, home, facts)) ? null : { at: Date.now(), attempt: 1 };
      },
      (retry) =>
        ctx.scheduler.runAt(retry.at, internal.slack.appHome.publishHome, {
          ...home,
          ...(unreported !== undefined && { unreportedOpeningAt: unreported }),
          attempt: retry.attempt,
        }),
    );
  },
});

export function appHomeLink(workspace: string, label: string) {
  const query = new URLSearchParams({ team: workspace, id: appId(), tab: "home" });
  return `<slack://app?${query}|${label}>`;
}

type Unavailable = { kind: "unavailable"; retryAfterMs?: number };

async function isLatest(ctx: ActionCtx, { workspace, user }: Home, published: HomeFacts) {
  return stampOf(await ctx.runQuery(internal.feedback.homes.homeOf, { workspace, user })) === stampOf(published);
}

type Home = { workspace: string; user: string; opened?: boolean };

async function homeFactsOf(ctx: ActionCtx, { workspace, user, opened }: Home): Promise<HomeFacts | Unavailable> {
  const refreshed = opened ? await refreshUser(ctx, workspace, user) : undefined;
  const known = await ctx.runQuery(internal.feedback.homes.homeOf, { workspace, user });
  if (known !== null) return known;
  const lookUp = refreshed ?? (await lookUpUser(ctx, workspace, user));
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
  return { type: "actions", elements: tabs.map((tab) => ({ ...buttonOf(tab), ...(tab.current && { style: "primary" }) })) };
}

function buttonOf({ label, intent }: HomeAction) {
  return { type: "button", action_id: actionIdOf(intent), text: plainText(label), value: JSON.stringify(intent) };
}

function channelPickerOf({ picks, picked }: Extract<HomeLine, { kind: "pick-channel" }>) {
  return { type: "channels_select", action_id: picks, placeholder: plainText("Pick a channel"), ...(picked !== null && { initial_channel: picked }) };
}

function actionIdOf(intent: HomeAction["intent"]) {
  return Object.entries(intent)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

const divider = { type: "divider" };

function blockOf(line: HomeLine) {
  if (line.kind === "fields") return { type: "section", fields: line.fields.map(mrkdwn) };
  if (line.kind === "hint") return { type: "context", elements: [mrkdwn(line.text)] };
  if (line.kind === "action") return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
  if (line.kind === "pick-channel") return { type: "section", text: mrkdwn(line.text), accessory: channelPickerOf(line) };
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
  if (!id) throw new ReportableError("SLACK_APP_ID is not set");
  return id;
}
