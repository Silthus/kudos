import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { baseEmojiName, parseKudosMessage } from "./lib/parse";
import { escapeMrkdwn, isSlackResponseUrl, rewardLine, siteUrl, slackApi, type SlackResponse } from "./lib/slack";
import { RARITY_SLACK_BADGE, type Rarity } from "./lib/messages";
import { OPEN_COUNT_CAP } from "./lib/store";

type SlackEvent = {
  type: string;
  subtype?: string;
  /** A user id, except on user_change / team_join where Slack sends the full user object. */
  user?: string | SlackUser;
  bot_id?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  ts?: string;
  tab?: string;
  reaction?: string;
  item_user?: string;
  item?: { type: string; channel: string; ts: string };
  tokens?: { bot?: string[]; oauth?: string[] };
};

const IGNORED_SUBTYPES = new Set([
  "message_changed",
  "message_deleted",
  "bot_message",
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
]);

/** Processes one Events API callback after the HTTP handler has acknowledged it. */
export const processEvent = internalAction({
  args: { teamId: v.string(), event: v.any() },
  returns: v.null(),
  handler: async (ctx, { teamId, event: raw }) => {
    const event = raw as SlackEvent;
    // Users revoking their own "Sign in with Slack" token must not disconnect everyone.
    const botTokenRevoked = event.type === "tokens_revoked" && (event.tokens?.bot?.length ?? 0) > 0;
    if (event.type === "app_uninstalled" || botTokenRevoked) {
      await ctx.runMutation(internal.slackData.markUninstalled, { teamId });
      return null;
    }
    if (event.type === "tokens_revoked") return null;
    const install = await ctx.runQuery(internal.slackData.workspaceForTeam, { teamId });
    if (!install) return null;
    const workspaceId = install.workspace._id as Id<"workspaces">;
    const emojiName = install.workspace.emojiName as string;

    // Directory changes: deactivations must lock people out promptly, new hires show up.
    if (event.type === "user_change" || event.type === "team_join") {
      if (typeof event.user !== "object" || !event.user?.id) return null;
      // Slack also reports external people from shared (Slack Connect) channels.
      if (event.user.team_id && event.user.team_id !== teamId) return null;
      await ctx.runMutation(internal.slackData.upsertSlackUsers, { workspaceId, users: [toMember(event.user)] });
      return null;
    }
    if (typeof event.user !== "string" && event.user !== undefined) return null;

    if (event.type === "message") {
      if (event.bot_id || !event.user || !event.text || !event.channel || !event.ts) return null;
      if (event.subtype && IGNORED_SUBTYPES.has(event.subtype)) return null;
      if (event.channel_type === "im") return null;
      if (!parseKudosMessage(event.text, emojiName)) return null;
      const channel = await channelInfo(install.botToken, event.channel);
      const result = await ctx.runMutation(internal.kudos.ingestMessage, {
        workspaceId,
        botUserId: install.botUserId,
        giverSlackId: event.user,
        text: event.text,
        channelId: event.channel,
        channelName: channel.name,
        channelPrivate: channel.isPrivate,
        messageTs: event.ts,
      });
      if (result) await deliver(ctx, install.botToken, result.notificationIds, event.channel);
      return null;
    }

    if (event.type === "reaction_added") {
      if (!event.user || !event.item_user || !event.reaction || event.item?.type !== "message") return null;
      if (baseEmojiName(event.reaction) !== emojiName) return null;
      if (event.user === install.botUserId) return null;
      const channel = await channelInfo(install.botToken, event.item.channel);
      const result = await ctx.runMutation(internal.kudos.ingestReaction, {
        workspaceId,
        botUserId: install.botUserId,
        reactorSlackId: event.user,
        authorSlackId: event.item_user,
        channelId: event.item.channel,
        channelName: channel.name,
        channelPrivate: channel.isPrivate,
        messageTs: event.item.ts,
        messageText: await messageText(install.botToken, event.item.channel, event.item.ts),
      });
      if (result) await deliver(ctx, install.botToken, result.notificationIds, event.item.channel);
      return null;
    }

    if (event.type === "app_home_opened" && event.tab === "home" && event.user) {
      await publishHome(ctx, workspaceId, install.botToken, event.user);
    }
    return null;
  },
});

async function channelInfo(token: string, channel: string): Promise<{ name?: string; isPrivate?: boolean }> {
  const info = await slackApi(token, "conversations.info", { channel });
  if (!info.ok) return {};
  const c = info.channel as { name?: string; is_private?: boolean };
  return { name: c.name ?? undefined, isPrivate: c.is_private || undefined };
}

type SlackMessage = { ts?: string; text?: string };

/**
 * Text of the exact message `ts`. conversations.history only sees top-level messages, so a
 * thread reply falls back to conversations.replies; never quote a neighbouring message.
 */
async function messageText(token: string, channel: string, ts: string): Promise<string | undefined> {
  const exact = (res: SlackResponse) =>
    ((res.messages as SlackMessage[] | undefined) ?? []).find((m) => m.ts === ts)?.text;
  const history = await slackApi(token, "conversations.history", { channel, latest: ts, oldest: ts, inclusive: true, limit: 1 });
  const top = history.ok ? exact(history) : undefined;
  if (top !== undefined) return top;
  const replies = await slackApi(token, "conversations.replies", { channel, ts, latest: ts, oldest: ts, inclusive: true, limit: 2 });
  return replies.ok ? exact(replies) : undefined;
}

const EPHEMERAL = new Set(["limit_reached", "self_kudos"]);

/**
 * Sends queued bot messages. Success messages go to DMs; "you can't do that"
 * replies are shown ephemerally in the channel where the attempt happened.
 */
async function deliver(ctx: ActionCtx, token: string, ids: Id<"notifications">[], channel?: string) {
  if (ids.length === 0) return;
  const rows = await ctx.runQuery(internal.slackData.notificationsForDelivery, { ids });
  const site = siteUrl();
  for (const n of rows) {
    if (n.delivery !== "pending") continue;
    const context = [
      RARITY_SLACK_BADGE[n.rarity as Rarity],
      n.isNewDiscovery ? `✨ New discovery! (${n.discoveredCount} collected)` : null,
      site ? `<${site}/discoveries|Message gallery>` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: n.slackText } },
      { type: "context", elements: [{ type: "mrkdwn", text: context }] },
    ];
    const res =
      EPHEMERAL.has(n.category) && channel
        ? await slackApi(token, "chat.postEphemeral", { channel, user: n.slackUserId, text: n.slackText, blocks })
        : await slackApi(token, "chat.postMessage", { channel: n.slackUserId, text: n.slackText, blocks });
    await ctx.runMutation(internal.slackData.markDelivery, {
      id: n._id,
      delivery: res.ok ? "sent" : "failed",
      error: res.ok ? undefined : res.error,
    });
  }
}

async function publishHome(ctx: ActionCtx, workspaceId: Id<"workspaces">, token: string, slackUserId: string) {
  const data = await ctx.runQuery(internal.slackData.homeData, { workspaceId, slackUserId });
  if (!data) return;
  const e = `:${data.emojiName}:`;
  const site = siteUrl();
  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
  const fields = [
    `*Left today*\n${data.remaining} / ${data.dailyLimit} ${e}`,
    `*Given this week*\n${data.weekGiven} ${e}${data.weekRank ? `  (#${data.weekRank})` : ""}`,
    `*Given all-time*\n${data.totalGiven} ${e}`,
    data.showReceived ? `*Received all-time*\n${data.totalReceived} ${e}` : `*Messages discovered*\n${data.discovered}`,
  ];
  const view = {
    type: "home",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Your kudos" } },
      { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
      {
        type: "actions",
        elements: [
          { type: "button", style: "primary", text: { type: "plain_text", text: "Open dashboard" }, url: `${site}/me`, action_id: "open_dashboard" },
          { type: "button", text: { type: "plain_text", text: "Message gallery" }, url: `${site}/discoveries`, action_id: "open_gallery" },
        ],
      },
      { type: "divider" },
      { type: "header", text: { type: "plain_text", text: "This week's most generous" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            (data.top as { slackUserId: string; given: number }[])
              .map((t, i) => `${medal(i)} <@${t.slackUserId}> · ${t.given} ${e}`)
              .join("\n") || "_No kudos yet this week. Be the first!_",
        },
      },
      ...storeSection(data.store, e, site),
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Give kudos: mention teammates and add ${e} to your message, e.g. \`@ana ${e}${e} thanks for the review!\` Every ${e} gives one kudos to each person you mention.`,
          },
        ],
      },
    ],
  };
  await slackApi(token, "views.publish", { user_id: slackUserId, view });
}

type StoreHome = { balance: number; rewards: { emoji: string; name: string; cost: number }[]; waiting: number | null };

/** The App Home "Rewards store" section; nothing at all while the store is closed. */
function storeSection(store: StoreHome | null, e: string, site: string) {
  if (!store) return [];
  const buttons = [{ type: "button", text: { type: "plain_text", text: "Open store" }, url: `${site}/store`, action_id: "open_store" }];
  const fields = [`*Balance*\n${store.balance} ${e}`];
  if (store.waiting !== null) {
    const count = store.waiting >= OPEN_COUNT_CAP ? `${OPEN_COUNT_CAP - 1}+` : String(store.waiting);
    fields.push(`*For admins*\n${count} ${store.waiting === 1 ? "request" : "requests"} waiting`);
    if (store.waiting > 0) {
      buttons.push({ type: "button", text: { type: "plain_text", text: "Review requests" }, url: `${site}/admin?tab=store`, action_id: "review_requests" });
    }
  }
  return [
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "Rewards store" } },
    { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        verbatim: true,
        text: store.rewards.map((r) => rewardLine(r, store.balance, e)).join("\n") || "_The shelves are empty. Your admins are still stocking the store._",
      },
    },
    { type: "actions", elements: buttons },
  ];
}

export const refreshHome = internalAction({
  args: { workspaceId: v.id("workspaces"), slackUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspaceId, slackUserId }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (install) await publishHome(ctx, workspaceId, install.botToken, slackUserId);
    return null;
  },
});

// ── Rewards Store ────────────────────────────────────────────────────────────

const redemptionEventValidator = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("fulfilled"),
  v.literal("declined"),
  v.literal("cancelled"),
);

/** Sends a DM; returns where it landed (the DM channel and ts), or null if Slack refused it. */
async function postDm(token: string, channel: string, text: string, blocks: object[]) {
  const res = await slackApi(token, "chat.postMessage", { channel, text, blocks });
  if (!res.ok) console.warn(`Store DM to ${channel} failed: ${res.error}`);
  return res.ok && typeof res.channel === "string" && typeof res.ts === "string" ? { channel: res.channel, ts: res.ts } : null;
}

/** mrkdwn that shows what people typed as-is: no auto-linked URLs, channels or mentions. */
const verbatim = (text: string) => ({ type: "mrkdwn", text, verbatim: true });

const button = (text: string, action_id: string, extra: object) => ({ type: "button", text: { type: "plain_text", text }, action_id, ...extra });

const DECIDED = { approved: "✅ Approved", fulfilled: "✔ Fulfilled", declined: "✖ Declined", cancelled: "↩ Cancelled" } as const;

/** Slack renders this in each reader's own time zone ("2 minutes ago"); the fallback is UTC. */
function ago(at: number) {
  const fallback = `${new Date(at).toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return `<!date^${Math.floor(at / 1000)}^{ago}|${fallback}>`;
}

type AdminCopy = {
  redemptionId: Id<"redemptions">;
  status: "pending" | keyof typeof DECIDED;
  requesterSlackUserId: string;
  reward: { name: string; emoji: string; cost: number };
  e: string;
  prompt?: string;
  answer?: string;
  /** Only in the first DM: the balance right after the request, which a later refund makes stale. */
  balance?: string | null;
  isOwn?: boolean;
  step?: { at: number; bySlackUserId: string | null; note?: string };
};

/**
 * An admin's copy of a request: who wants what, the answer, and what can still be done. Once
 * someone decided, it says who and when, and only offers the steps that are left (spec §7).
 * Declining stays on the web, where there's room for a reason.
 */
function adminCopy(copy: AdminCopy) {
  const site = siteUrl();
  const item = `*${escapeMrkdwn(`${copy.reward.emoji} ${copy.reward.name}`)}*`;
  const ask = `🛎️ <@${copy.requesterSlackUserId}> wants ${item} (${copy.reward.cost} ${copy.e}).`;
  const answer = copy.answer && `Answer${copy.prompt ? ` to “${escapeMrkdwn(copy.prompt)}”` : ""}: ${escapeMrkdwn(copy.answer)}`;
  const decided = copy.status === "pending" ? null : `${DECIDED[copy.status]} by ${copy.step?.bySlackUserId ? `<@${copy.step.bySlackUserId}>` : "an admin"}`;
  const note = copy.step?.note ? `: “${escapeMrkdwn(copy.step.note)}”` : "";
  const value = copy.redemptionId;
  const buttons = [
    ...(copy.status === "pending" ? [button("Approve", "store_approve", { style: "primary", value })] : []),
    ...(copy.status === "pending" || copy.status === "approved" ? [button("Mark fulfilled", "store_fulfill", { value })] : []),
  ];
  if (buttons.length > 0 && site) buttons.push(button("Review in Kudos", "store_review", { url: `${site}/admin?tab=store` }));
  const text = decided ? `${ask} ${decided}` : `${ask}${copy.balance ? ` Balance after: ${copy.balance}.` : ""}`;
  return {
    text,
    blocks: [
      { type: "section", text: verbatim(decided ? ask : text) },
      ...(answer ? [{ type: "section", text: verbatim(answer) }] : []),
      ...(copy.isOwn ? [{ type: "context", elements: [{ type: "mrkdwn", text: "👤 Your own request. You're the only admin who can decide it." }] }] : []),
      ...(decided ? [{ type: "context", elements: [verbatim(`${decided} · ${ago(copy.step!.at)}${note}`)] }] : []),
      ...(buttons.length > 0 ? [{ type: "actions", elements: buttons }] : []),
    ],
  };
}

/**
 * Tells the requester (and, for a new request, the admins) about one step of a redemption,
 * then refreshes the requester's App Home. Transactional DMs, not rarity-rolled bot messages
 * (spec D13). Scheduled by the store helpers with `balance` as it was right after the step,
 * since later steps may already have happened; a Slack failure never blocks the step.
 */
export const notifyRedemption = internalAction({
  args: { redemptionId: v.id("redemptions"), event: redemptionEventValidator, balance: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event } = args;
    const data = await ctx.runQuery(internal.slackData.redemptionForSlack, { redemptionId: args.redemptionId, withAdmins: event === "requested" });
    if (!data) return null;
    const { botToken: token, requester, reward } = data;
    const e = `:${data.emojiName}:`;
    const site = siteUrl();
    const item = `*${escapeMrkdwn(`${reward.emoji} ${reward.name}`)}*`;
    const cost = `${reward.cost} ${e}`;
    const balance = data.showBalance ? `${args.balance} ${e}` : null;

    // Word the DM for the step it's about, not the current status: a later step may already have happened.
    const step = [...data.history].reverse().find((h) => h.status === (event === "requested" ? "pending" : event));
    const by = step?.bySlackUserId ? `<@${step.bySlackUserId}>` : "an admin";
    const note = step?.note ? escapeMrkdwn(step.note) : null;
    const noteFrom = note ? ` Note from ${by}: ${note}` : "";
    const endsSentence = note !== null && /[.!?…]$/.test(note);
    const update = {
      // A request withdrawn before this went out needs no confirmation.
      requested:
        data.status === "cancelled"
          ? null
          : `🎁 Your request for ${item} (${cost}) is in. An admin will take it from here.${balance ? ` Balance: ${balance}.` : ""}`,
      approved: `✅ ${by} approved ${item}. It's on its way.${noteFrom}`,
      fulfilled: `🎉 ${item} is yours!${noteFrom}`,
      declined: `${item} was declined by ${by}${note ? `: “${note}”${endsSentence ? "" : "."}` : "."} ${cost} are back in your balance${balance ? ` (${balance})` : ""}.`,
      cancelled: null, // they did it themselves
    }[event];
    if (update && !requester.deactivated) {
      // The store page only exists while the store is open.
      const link = site && data.storeOpen ? `Follow it under <${site}/store#my-requests|My requests>` : null;
      await postDm(token, requester.slackUserId, update, [
        { type: "section", text: verbatim(update) },
        ...(link ? [{ type: "context", elements: [{ type: "mrkdwn", text: link }] }] : []),
      ]);
    }

    const copies: { channel: string; ts: string }[] = [];
    for (const admin of data.admins) {
      const { text, blocks } = adminCopy({
        redemptionId: args.redemptionId,
        status: "pending",
        requesterSlackUserId: requester.slackUserId,
        reward,
        e,
        prompt: data.prompt,
        answer: data.answer,
        balance,
        isOwn: admin.isOwn,
      });
      const sent = await postDm(token, admin.slackUserId, text, blocks);
      if (sent) copies.push(sent);
    }
    if (copies.length > 0) await ctx.runMutation(internal.slackData.saveAdminMessages, { redemptionId: args.redemptionId, messages: copies });

    if (!requester.deactivated) await publishHome(ctx, data.workspaceId, token, requester.slackUserId);
    return null;
  },
});

/**
 * Rewrites every admin's copy of a request after a step, from the web or from Slack. Syncs can
 * overlap, so each one re-reads the request after updating and goes again if it moved on: the
 * last one to finish always shows the latest state.
 */
export const syncAdminMessages = internalAction({
  args: { redemptionId: v.id("redemptions") },
  returns: v.null(),
  handler: async (ctx, { redemptionId }) => {
    let shown: string | null = null;
    for (let round = 0; round < 3; round++) {
      const data = await ctx.runQuery(internal.slackData.adminCopies, { redemptionId });
      if (!data || data.version === shown) return null;
      const { text, blocks } = adminCopy({
        redemptionId,
        status: data.status,
        requesterSlackUserId: data.requesterSlackUserId,
        reward: data.reward,
        e: `:${data.emojiName}:`,
        prompt: data.prompt,
        answer: data.answer,
        step: data.step,
      });
      for (const { channel, ts } of data.messages) {
        const res = await slackApi(data.botToken, "chat.update", { channel, ts, text, blocks });
        if (!res.ok) console.warn(`Updating the store DM ${channel}/${ts} failed: ${res.error}`);
      }
      shown = data.version;
    }
    return null;
  },
});

/** Answers an interaction with a message only the person who clicked sees. */
export const respond = internalAction({
  args: { responseUrl: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (_ctx, { responseUrl, text }) => {
    if (!isSlackResponseUrl(responseUrl)) return null;
    try {
      const res = await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
      });
      if (!res.ok) console.warn(`Answering a Slack interaction failed: http_${res.status}`);
    } catch (e) {
      console.warn(`Answering a Slack interaction failed: ${e instanceof Error ? e.message : e}`);
    }
    return null;
  },
});

type SlackUser = {
  id: string;
  team_id?: string;
  name: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; title?: string; image_192?: string };
};

function toMember(u: SlackUser) {
  return {
    slackUserId: u.id,
    name: u.profile?.display_name || u.profile?.real_name || u.real_name || u.name,
    realName: u.profile?.real_name || u.real_name || undefined,
    title: u.profile?.title || undefined,
    avatarUrl: u.profile?.image_192,
    isBot: Boolean(u.is_bot) || u.id === "USLACKBOT",
    deactivated: Boolean(u.deleted),
    isSlackAdmin: Boolean(u.is_admin || u.is_owner),
  };
}

export const syncMember = internalAction({
  args: { workspaceId: v.id("workspaces"), slackUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspaceId, slackUserId }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (!install) return null;
    const res = await slackApi(install.botToken, "users.info", { user: slackUserId });
    if (!res.ok) return null;
    await ctx.runMutation(internal.slackData.upsertSlackUsers, {
      workspaceId,
      users: [toMember(res.user as SlackUser)],
    });
    return null;
  },
});

/** Imports the whole Slack directory, one page per scheduled run. */
export const syncAllMembers = internalAction({
  args: { workspaceId: v.id("workspaces"), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, cursor }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (!install) return null;
    if (!cursor) {
      const team = await slackApi(install.botToken, "team.info");
      const t = team.team as { name?: string; icon?: { image_132?: string } } | undefined;
      if (team.ok && t) {
        await ctx.runMutation(internal.slackData.setWorkspaceIcon, {
          workspaceId,
          iconUrl: t.icon?.image_132,
          name: t.name,
        });
      }
    }
    const res = await slackApi(install.botToken, "users.list", { limit: 200, cursor });
    if (!res.ok) return null;
    await ctx.runMutation(internal.slackData.upsertSlackUsers, {
      workspaceId,
      users: (res.members as SlackUser[]).map(toMember),
    });
    const next = (res.response_metadata as { next_cursor?: string } | undefined)?.next_cursor;
    if (next) await ctx.scheduler.runAfter(1500, internal.slack.syncAllMembers, { workspaceId, cursor: next });
    return null;
  },
});

/**
 * Registers a workspace from a bot token when the app was installed from Slack's
 * app settings page instead of /slack/install. Slack workspace admins become Kudos admins.
 * `npx convex run --prod slack:bootstrapInstall '{"botToken":"xoxb-…"}'`
 */
export const bootstrapInstall = internalAction({
  args: { botToken: v.string() },
  returns: v.object({ workspaceId: v.id("workspaces"), team: v.string() }),
  handler: async (ctx, { botToken }): Promise<{ workspaceId: Id<"workspaces">; team: string }> => {
    const who = await slackApi(botToken, "auth.test");
    if (!who.ok) throw new Error(`auth.test failed: ${who.error}`);
    const teamId = who.team_id as string;
    const team = who.team as string;
    const bot = await slackApi(botToken, "bots.info", { bot: who.bot_id as string });
    const workspaceId: Id<"workspaces"> = await ctx.runMutation(internal.slackData.saveInstallation, {
      teamId,
      teamName: team,
      botToken,
      botUserId: who.user_id as string,
      appId: ((bot.bot as { app_id?: string } | undefined)?.app_id) ?? "",
      scope: "",
    });
    await ctx.runAction(internal.slack.syncAllMembers, { workspaceId });
    return { workspaceId, team };
  },
});
