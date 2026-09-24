import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpAction, type ActionCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { auth } from "./auth";
import {
  BOT_SCOPES,
  convexSiteUrl,
  holdsInstallState,
  installStateCookie,
  siteUrl,
  slackManifest,
  spentInstallStateCookie,
  verifySlackSignature,
  webLink,
} from "./lib/slack";

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

/** A 302 that can also set a cookie (`Response.redirect`'s headers are immutable). */
const redirect = (location: string, cookie?: string) =>
  new Response(null, { status: 302, headers: { Location: location, ...(cookie ? { "Set-Cookie": cookie } : {}) } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Verified = { ok: true; body: string } | { ok: false; response: Response };

const notConfigured = () => new Response("SLACK_SIGNING_SECRET is not configured", { status: 503 });

async function verified(request: Request): Promise<Verified> {
  const body = await request.text();
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return { ok: false, response: notConfigured() };
  if (!(await verifySlackSignature(secret, request.headers, body))) {
    return { ok: false, response: new Response("invalid signature", { status: 401 }) };
  }
  return { ok: true, body };
}

/** Without a signing secret, only Slack's URL check gets through, unsigned; everything else waits for the secret. */
async function unsignedUrlCheck(request: Request): Promise<Verified> {
  const body = await request.text();
  let type: unknown;
  try {
    type = JSON.parse(body)?.type;
  } catch {
    type = undefined;
  }
  if (type !== "url_verification") return { ok: false, response: notConfigured() };
  return { ok: true, body };
}

/**
 * Slack signs a slash command but gives it no id, so a captured request verifies again for the
 * 5 minutes its timestamp is accepted. Its signature is unique to it (real commands carry a
 * fresh `trigger_id`), so each one is claimed once, like an event id.
 */
async function claimRequest(ctx: ActionCtx, request: Request) {
  return await ctx.runMutation(internal.slackData.claimEvent, {
    eventId: `request:${request.headers.get("x-slack-signature")}`,
  });
}

// Slack Events API (HTTP webhooks, no Socket Mode).
http.route({
  path: "/slack/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Answer Slack's URL check even before the signing secret is configured, so the
    // manifest's request URL verifies on app creation. Echoing the challenge is harmless.
    // Once there is a secret, nothing is read before the signature checks out.
    const check = process.env.SLACK_SIGNING_SECRET ? await verified(request) : await unsignedUrlCheck(request);
    if (!check.ok) return check.response;
    let payload: { type?: string; challenge?: string; team_id?: string; event_id?: string; event?: EventText };
    try {
      payload = JSON.parse(check.body);
    } catch {
      return new Response("bad request", { status: 400 });
    }
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
    if (!(await claimRequest(ctx, request))) return new Response("", { status: 200 });
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
    return redirect(url.toString(), installStateCookie(state));
  }),
});

http.route({
  path: "/slack/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const site = siteUrl();
    // Once the state is spent, so is the browser's cookie for it.
    let spent: string | undefined;
    const fail = (reason: string) => redirect(`${site}/?install_error=${encodeURIComponent(reason)}`, spent);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error")) return fail(url.searchParams.get("error")!);
    if (!code || !state) return fail("missing_code");
    // A callback link opened in another browser (login CSRF) must not install into that session.
    if (!holdsInstallState(request.headers, state)) return fail("state_mismatch");
    spent = spentInstallStateCookie();
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
    // Opens the workspace just installed, for someone already signed in to another one.
    const installed = `/?installed=${encodeURIComponent(data.team.name)}`;
    return redirect(webLink(data.team.id, installed) ?? `${site}${installed}`, spent);
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
