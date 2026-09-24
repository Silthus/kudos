import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { auth } from "./auth";
import { BOT_SCOPES, convexSiteUrl, siteUrl, slackManifest, verifySlackSignature } from "./lib/slack";

const http = httpRouter();

auth.addHttpRoutes(http);

const HANDLED_EVENTS = new Set([
  "message",
  "reaction_added",
  "app_home_opened",
  "app_uninstalled",
  "tokens_revoked",
  "user_change",
  "team_join",
]);

type EventText = { type?: string; subtype?: string; text?: string; message?: { text?: string }; previous_message?: { text?: string } };

/** Cheap pre-filter so ordinary chatter never costs a write or an action. */
function isWorthProcessing(event: EventText) {
  if (!event.type || !HANDLED_EVENTS.has(event.type)) return false;
  if (event.type !== "message") return true;
  // An edit carries the message's text before and after it, not at the top level.
  const texts = event.subtype === "message_changed" ? [event.message?.text, event.previous_message?.text] : [event.text];
  return texts.some((text) => (text ?? "").includes(":"));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function verified(request: Request): Promise<{ ok: true; body: string } | { ok: false; response: Response }> {
  const body = await request.text();
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return { ok: false, response: new Response("SLACK_SIGNING_SECRET is not configured", { status: 503 }) };
  if (!(await verifySlackSignature(secret, request.headers, body))) {
    return { ok: false, response: new Response("invalid signature", { status: 401 }) };
  }
  return { ok: true, body };
}

// Slack Events API (HTTP webhooks, no Socket Mode).
http.route({
  path: "/slack/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.clone().text();
    let payload: { type?: string; challenge?: string; team_id?: string; event_id?: string; event?: EventText };
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("bad request", { status: 400 });
    }
    // Answer Slack's URL check even before the signing secret is configured, so the
    // manifest's request URL verifies on app creation. Echoing the challenge is harmless.
    if (payload.type === "url_verification" && !process.env.SLACK_SIGNING_SECRET) {
      return json({ challenge: payload.challenge });
    }
    const check = await verified(request);
    if (!check.ok) return check.response;
    if (payload.type === "url_verification") return json({ challenge: payload.challenge });
    if (payload.type !== "event_callback" || !payload.team_id || !payload.event_id || !payload.event) {
      return new Response("", { status: 200 });
    }
    if (!isWorthProcessing(payload.event)) return new Response("", { status: 200 });
    const fresh = await ctx.runMutation(internal.slackData.claimEvent, { eventId: payload.event_id });
    if (fresh) {
      await ctx.scheduler.runAfter(0, internal.slack.processEvent, {
        teamId: payload.team_id,
        event: payload.event,
      });
    }
    return new Response("", { status: 200 });
  }),
});

http.route({
  path: "/slack/commands",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const check = await verified(request);
    if (!check.ok) return check.response;
    const form = new URLSearchParams(check.body);
    const response = await ctx.runMutation(internal.slackData.slashCommand, {
      teamId: form.get("team_id") ?? "",
      slackUserId: form.get("user_id") ?? "",
      text: form.get("text") ?? "",
    });
    return json(response);
  }),
});

const STORE_ACTIONS = { store_approve: "approve", store_fulfill: "fulfill" } as const;

type InteractionPayload = {
  type?: string;
  team?: { id?: string } | null;
  user?: { id?: string; team_id?: string };
  response_url?: string;
  actions?: { action_id?: unknown; value?: unknown }[];
};

// Approve and Mark fulfilled in the admins' store DMs. Every other button only opens a URL,
// so it's just acknowledged. Refusals ("Already fulfilled by Lena.") are answered ephemerally.
http.route({
  path: "/slack/interactions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const check = await verified(request);
    if (!check.ok) return check.response;
    let payload: InteractionPayload;
    try {
      payload = JSON.parse(new URLSearchParams(check.body).get("payload") ?? "");
    } catch {
      return new Response("bad request", { status: 400 });
    }
    if (typeof payload !== "object" || payload === null) return new Response("bad request", { status: 400 });
    const [action] = payload.type === "block_actions" && Array.isArray(payload.actions) ? payload.actions : [];
    const id = action?.action_id;
    const step = typeof id === "string" && Object.hasOwn(STORE_ACTIONS, id) ? STORE_ACTIONS[id as keyof typeof STORE_ACTIONS] : undefined;
    // Enterprise Grid sends no `team` for org-wide apps; the user's own team is the workspace then.
    const teamId = payload.team?.id ?? payload.user?.team_id;
    if (!step || typeof action.value !== "string" || typeof teamId !== "string" || typeof payload.user?.id !== "string") {
      return new Response("", { status: 200 });
    }
    const refusal = await ctx.runMutation(internal.slackData.storeInteraction, {
      teamId,
      slackUserId: payload.user.id,
      userTeamId: payload.user.team_id,
      action: step,
      redemptionId: action.value,
    });
    if (refusal && typeof payload.response_url === "string") {
      await ctx.scheduler.runAfter(0, internal.slack.respond, { responseUrl: payload.response_url, text: refusal });
    }
    return new Response("", { status: 200 });
  }),
});

http.route({
  path: "/slack/install",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) return new Response("SLACK_CLIENT_ID is not configured", { status: 503 });
    const state = await ctx.runMutation(internal.slackData.createOAuthState, {});
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", BOT_SCOPES.join(","));
    url.searchParams.set("redirect_uri", `${convexSiteUrl()}/slack/oauth/callback`);
    url.searchParams.set("state", state);
    return Response.redirect(url.toString(), 302);
  }),
});

http.route({
  path: "/slack/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const site = siteUrl();
    const fail = (reason: string) => Response.redirect(`${site}/?install_error=${encodeURIComponent(reason)}`, 302);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error")) return fail(url.searchParams.get("error")!);
    if (!code || !state) return fail("missing_code");
    if (!(await ctx.runMutation(internal.slackData.consumeOAuthState, { state }))) return fail("expired_state");

    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID ?? "",
        client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
        redirect_uri: `${convexSiteUrl()}/slack/oauth/callback`,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
      bot_user_id?: string;
      app_id?: string;
      scope?: string;
      team?: { id: string; name: string };
      authed_user?: { id: string };
    };
    if (!data.ok || !data.access_token || !data.team || !data.bot_user_id || !data.authed_user) {
      return fail(data.error ?? "oauth_failed");
    }
    const workspaceId = await ctx.runMutation(internal.slackData.saveInstallation, {
      teamId: data.team.id,
      teamName: data.team.name,
      botToken: data.access_token,
      botUserId: data.bot_user_id,
      appId: data.app_id ?? "",
      installerSlackId: data.authed_user.id,
      scope: data.scope ?? "",
    });
    await ctx.scheduler.runAfter(0, internal.slack.syncAllMembers, { workspaceId });
    return Response.redirect(`${site}/?installed=${encodeURIComponent(data.team.name)}`, 302);
  }),
});

http.route({
  path: "/slack/manifest.json",
  method: "GET",
  handler: httpAction(async () => json(slackManifest(convexSiteUrl()))),
});

// Everything else is the React app (SPA fallback to index.html).
registerStaticRoutes(http, components.staticHosting);

export default http;
