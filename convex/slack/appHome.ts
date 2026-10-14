import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type ActionCtx, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { recordUsage, recordUsageWithoutBlocking } from "../analytics/usage";
import type { HomeFacts } from "../engine/home";
import { renderHome, type Choice, type HomeLine, type HomeView } from "../feedback/home";
import { xpLevelsShownTo } from "../progression/xpLevels";
import { lookup } from "../workspace/directory";
import { buttonOf, mrkdwn, plainText, urlButtonOf } from "./blocks";
import { attemptArgs, failedAttempt, sendOnce, slackTextOf, tryAtMostThreeTimes } from "./delivery";
import { lookUpUser, refreshUser } from "./directory";
import { groupSelectOf } from "./groupPicker";

export type HomeOpened = { type: "app_home_opened"; user: string; tab: "home" | "messages" };

export function isHomeTabOpened(event: { type: string }): event is HomeOpened {
  return event.type === "app_home_opened" && (event as HomeOpened).tab === "home";
}

type Opening = { workspace: string; user: string; at: number };

export async function reportHomeOpened(ctx: MutationCtx, { workspace, user, at }: Opening): Promise<"reported" | "unknown-person"> {
  const person = await lookup(ctx, workspace, user);
  if (person === undefined) return "unknown-person";
  if (person.kind !== "member") return "reported";
  await recordUsage(ctx, { kind: "appHomeOpened", workspace, member: person.member, at });
  await xpLevelsShownTo(ctx, person.member);
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
        const desired = await desiredHomeOf(ctx, home);
        if (desired.kind === "unavailable") return failedAttempt(attempt, desired.retryAfterMs);
        if (unreported !== undefined) {
          const at = unreported;
          await recordUsageWithoutBlocking(() => ctx.runMutation(internal.slack.appHome.reportLookedUpHomeOpening, { workspace: home.workspace, user: home.user, at }));
          unreported = undefined;
        }
        const { view } = desired;
        const retry = await sendOnce(ctx, home.workspace, "views.publish", { user_id: home.user, view }, attempt);
        if (retry === null && (await changedWhileSent(ctx, home, view))) {
          await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, { workspace: home.workspace, user: home.user });
        }
        return retry;
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

type Home = { workspace: string; user: string; opened?: boolean };

type Unavailable = { kind: "unavailable"; retryAfterMs?: number };

async function desiredHomeOf(ctx: ActionCtx, home: Home): Promise<{ kind: "view"; view: SlackHomeView } | Unavailable> {
  const facts = await homeFactsOf(ctx, home);
  if (facts.kind === "unavailable") return facts;
  const frontDoor = await ctx.runQuery(internal.website.link.frontDoorLinksOf, { workspace: home.workspace, user: home.user });
  const shown = await ctx.runMutation(internal.feedback.homes.shownHomeOf, { workspace: home.workspace, user: home.user, frontDoor: frontDoor !== null });
  return { kind: "view", view: homeView(renderHome(facts, shown, frontDoor)) };
}

async function changedWhileSent(ctx: ActionCtx, { workspace, user }: Home, sent: SlackHomeView) {
  const desired = await desiredHomeOf(ctx, { workspace, user });
  return desired.kind === "view" && JSON.stringify(desired.view) !== JSON.stringify(sent);
}

async function homeFactsOf(ctx: ActionCtx, { workspace, user, opened }: Home): Promise<HomeFacts | Unavailable> {
  const refreshed = opened ? await refreshUser(ctx, workspace, user) : undefined;
  const known = await ctx.runQuery(internal.engine.home.homeOf, { workspace, user });
  if (known !== null) return known;
  const lookUp = refreshed ?? (await lookUpUser(ctx, workspace, user));
  if (lookUp.kind === "failed") return { kind: "unavailable", ...(lookUp.retryAfterMs !== undefined && { retryAfterMs: lookUp.retryAfterMs }) };
  return (await ctx.runQuery(internal.engine.home.homeOf, { workspace, user })) ?? { kind: "unavailable" };
}

type SlackHomeView = ReturnType<typeof homeView>;

function homeView({ tabBar, title, groups }: HomeView) {
  const tabs = tabBar === undefined ? [] : [buttonsOf(tabBar)];
  const header = { type: "header", text: plainText(title) };
  const body = groups.flatMap((group, index) => [...(index > 0 ? [divider] : []), ...group.map(blockOf)]);
  return { type: "home", blocks: [...tabs, header, ...body] };
}

const divider = { type: "divider" };

const settingsPick = JSON.stringify({ type: "pickPrimaryGroup", surface: "settings" });

function blockOf(line: HomeLine) {
  if (line.kind === "fields") return { type: "section", fields: line.fields.map(mrkdwn) };
  if (line.kind === "choices") return buttonsOf(line.choices);
  if (line.kind === "lines") return { type: "section", text: mrkdwn(slackTextOf(line.lines)) };
  if (line.kind === "hint") return { type: "context", elements: [mrkdwn(line.text)] };
  if (line.kind === "action") return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
  if (line.kind === "pick-channel") return { type: "section", text: mrkdwn(line.text), accessory: channelPickerOf(line) };
  if (line.kind === "pick-group") return { type: "section", text: mrkdwn(line.text), accessory: groupSelectOf(settingsPick, line.groups, line.picked) };
  if (line.kind === "link") return { type: "section", text: mrkdwn(`<${line.url}|${line.label}>`) };
  if (line.kind === "links") return { type: "actions", elements: line.links.map(linkButtonOf) };
  return { type: "section", text: mrkdwn(line.text) };
}

function buttonsOf(choices: Choice[]) {
  return { type: "actions", elements: choices.map(({ selected, ...action }) => ({ ...buttonOf(action), ...(selected && { style: "primary" }) })) };
}

function linkButtonOf({ label, url }: { label: string; url: string }, index: number) {
  return urlButtonOf({ label, url, actionId: `website-link-${index}` });
}

function channelPickerOf({ picks, picked }: Extract<HomeLine, { kind: "pick-channel" }>) {
  return { type: "channels_select", action_id: picks, placeholder: plainText("Pick a channel"), ...(picked !== null && { initial_channel: picked }) };
}

function appId() {
  const id = process.env.SLACK_APP_ID;
  if (!id) throw new ReportableError("SLACK_APP_ID is not set");
  return id;
}
