import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { recordUsage, recordUsageWithoutBlocking } from "../analytics/usage";
import type { HomeFacts } from "../engine/home";
import { renderHome, type Choice, type HomeLine, type HomeView } from "../feedback/home";
import { lookup } from "../workspace/directory";
import { attemptArgs, failedAttempt, sendOnce, slackTextOf, tryAtMostThreeTimes } from "./delivery";
import { lookUpUser } from "./directory";
import { encodeHomeAction } from "./interactivity";

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
  args: { workspace: v.string(), user: v.string(), unreportedOpeningAt: v.optional(v.number()), ...attemptArgs },
  handler: async (ctx, { attempt = 1, unreportedOpeningAt, ...opened }) => {
    let unreported = unreportedOpeningAt;
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const desired = await desiredHomeOf(ctx, opened.workspace, opened.user);
        if (desired.kind === "unavailable") return failedAttempt(attempt, desired.retryAfterMs);
        if (unreported !== undefined) {
          const at = unreported;
          await recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.appHome.reportLookedUpHomeOpening, { ...opened, at }));
          unreported = undefined;
        }
        const { view } = desired;
        const retry = await sendOnce(ctx, opened.workspace, "views.publish", { user_id: opened.user, view }, attempt);
        if (retry === null && (await changedWhileSent(ctx, opened.workspace, opened.user, view))) {
          await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, opened);
        }
        return retry;
      },
      (retry) =>
        ctx.scheduler.runAt(retry.at, internal.slack.appHome.publishHome, {
          ...opened,
          ...(unreported !== undefined && { unreportedOpeningAt: unreported }),
          attempt: retry.attempt,
        }),
    );
  },
});

async function desiredHomeOf(ctx: ActionCtx, workspace: string, user: string): Promise<{ kind: "view"; view: SlackHomeView } | Unavailable> {
  const facts = await homeFactsOf(ctx, workspace, user);
  if (facts.kind === "unavailable") return facts;
  const shown = await ctx.runMutation(internal.feedback.homeTabs.shownTabOf, { workspace, user });
  return { kind: "view", view: homeView(renderHome(facts, shown)) };
}

async function changedWhileSent(ctx: ActionCtx, workspace: string, user: string, sent: SlackHomeView) {
  const desired = await desiredHomeOf(ctx, workspace, user);
  return desired.kind === "view" && JSON.stringify(desired.view) !== JSON.stringify(sent);
}

export function appHomeLink(workspace: string, label: string) {
  const query = new URLSearchParams({ team: workspace, id: appId(), tab: "home" });
  return `<slack://app?${query}|${label}>`;
}

type Unavailable = { kind: "unavailable"; retryAfterMs?: number };

async function homeFactsOf(ctx: ActionCtx, workspace: string, user: string): Promise<HomeFacts | Unavailable> {
  const known = await ctx.runQuery(internal.engine.home.homeOf, { workspace, user });
  if (known !== null) return known;
  const lookUp = await lookUpUser(ctx, workspace, user);
  if (lookUp.kind === "failed") return { kind: "unavailable", ...(lookUp.retryAfterMs !== undefined && { retryAfterMs: lookUp.retryAfterMs }) };
  return (await ctx.runQuery(internal.engine.home.homeOf, { workspace, user })) ?? { kind: "unavailable" };
}

type SlackHomeView = ReturnType<typeof homeView>;

function homeView({ tabBar, title, groups }: HomeView) {
  const tabs = tabBar === undefined ? [] : [buttonsOf(tabBar)];
  const header = { type: "header", text: { type: "plain_text", text: title } };
  const body = groups.flatMap((group, index) => [...(index > 0 ? [divider] : []), ...group.map(blockOf)]);
  return { type: "home", blocks: [...tabs, header, ...body] };
}

const divider = { type: "divider" };

function blockOf(line: HomeLine) {
  if (line.kind === "fields") return { type: "section", fields: line.fields.map(mrkdwn) };
  if (line.kind === "choices") return buttonsOf(line.choices);
  if (line.kind === "lines") return { type: "section", text: mrkdwn(slackTextOf(line.lines)) };
  if (line.kind === "hint") return { type: "context", elements: [mrkdwn(line.text)] };
  return { type: "section", text: mrkdwn(line.text) };
}

function buttonsOf(choices: Choice[]) {
  return { type: "actions", elements: choices.map(buttonOf) };
}

function buttonOf({ label, command, selected }: Choice) {
  const action = encodeHomeAction(command);
  return { type: "button", text: { type: "plain_text", text: label }, action_id: action, value: action, ...(selected && { style: "primary" }) };
}

function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

function appId() {
  const id = process.env.SLACK_APP_ID;
  if (!id) throw new ReportableError("SLACK_APP_ID is not set");
  return id;
}
