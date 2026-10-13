import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import type { HomeFacts } from "../engine/home";
import { renderHome } from "../feedback/home";
import { lookUpUser } from "./directory";
import { callSlack } from "./webApi";

export type HomeOpened = { type: "app_home_opened"; user: string; tab: "home" | "messages" };

export function isHomeTabOpened(event: { type: string }): event is HomeOpened {
  return event.type === "app_home_opened" && (event as HomeOpened).tab === "home";
}

export const publishHome = internalAction({
  args: { workspace: v.string(), user: v.string() },
  handler: async (ctx, { workspace, user }) => {
    const facts = await homeFactsOf(ctx, workspace, user);
    if (facts === null) return;
    const answer = await callSlack("views.publish", { user_id: user, view: homeView(renderHome(facts)) });
    if (!answer.ok) console.warn(`views.publish failed: ${answer.error}`);
  },
});

export function appHomeLink(workspace: string, label: string) {
  const query = new URLSearchParams({ team: workspace, id: appId(), tab: "home" });
  return `<slack://app?${query}|${label}>`;
}

async function homeFactsOf(ctx: ActionCtx, workspace: string, user: string): Promise<HomeFacts | null> {
  const known = await ctx.runQuery(internal.engine.home.homeOf, { workspace, user });
  if (known !== null) return known;
  await lookUpUser(ctx, workspace, user);
  return ctx.runQuery(internal.engine.home.homeOf, { workspace, user });
}

function homeView(lines: string[]) {
  return { type: "home", blocks: lines.map((line) => ({ type: "section", text: { type: "mrkdwn", text: line } })) };
}

function appId() {
  const id = process.env.SLACK_APP_ID;
  if (!id) throw new Error("SLACK_APP_ID is not set");
  return id;
}
