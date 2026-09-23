const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSlackRequest(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`v0:${timestamp}:${body}`));
  return `v0=${toHex(sig)}`;
}

/** Verifies Slack's `X-Slack-Signature` header (HMAC-SHA256, 5 minute replay window). */
export async function verifySlackSignature(
  secret: string,
  headers: Headers,
  body: string,
  now = Date.now(),
): Promise<boolean> {
  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 60 * 5) return false;
  return timingSafeEqual(await signSlackRequest(secret, timestamp, body), signature);
}

export type SlackResponse = { ok: boolean; error?: string; [key: string]: unknown };

/** Calls a Slack Web API method with a form-encoded body. */
export async function slackApi(
  token: string,
  method: string,
  params: Record<string, string | number | boolean | object | undefined> = {},
): Promise<SlackResponse> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    body.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (res.status === 429) {
      return { ok: false, error: `ratelimited (retry after ${res.headers.get("retry-after") ?? "?"}s)` };
    }
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return (await res.json()) as SlackResponse;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

export const BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:read",
  "chat:write",
  "commands",
  "groups:history",
  "groups:read",
  "im:write",
  "reactions:read",
  "team:read",
  "users:read",
];

export const BOT_EVENTS = [
  "app_home_opened",
  "app_uninstalled",
  "message.channels",
  "message.groups",
  "reaction_added",
  "tokens_revoked",
];

/** Origin of this deployment's HTTP actions: webhooks and OAuth callbacks live here. */
export function convexSiteUrl() {
  return (process.env.CONVEX_SITE_URL ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
}

/** Origin of the web app, for browser redirects and links. */
export function siteUrl() {
  return (process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
}

export function slackManifest(base: string, appName = "Kudos") {
  return {
    display_information: {
      name: appName,
      description: "Celebrate your teammates with kudos, right inside Slack.",
      background_color: "#16110d",
      long_description:
        "Give kudos by mentioning teammates together with the kudos emoji. Everyone gets a daily allowance, collects rare bot messages, and can follow the leaderboard and personal stats in the Kudos web app.",
    },
    features: {
      app_home: { home_tab_enabled: true, messages_tab_enabled: true, messages_tab_read_only_enabled: true },
      bot_user: { display_name: appName, always_online: true },
      slash_commands: [
        {
          command: "/kudos",
          url: `${base}/slack/commands`,
          description: "Your kudos balance, stats and the weekly leaderboard",
          usage_hint: "[me | top | help]",
          should_escape: false,
        },
      ],
    },
    oauth_config: {
      redirect_urls: [`${base}/slack/oauth/callback`, `${base}/api/auth/callback/slack`],
      scopes: { bot: BOT_SCOPES, user: ["openid", "profile", "email"] },
    },
    settings: {
      event_subscriptions: { request_url: `${base}/slack/events`, bot_events: BOT_EVENTS },
      interactivity: { is_enabled: true, request_url: `${base}/slack/interactions` },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}
