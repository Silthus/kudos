import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { baseEmojiName, mentionedUsers } from "./lib/parse";
import { kudosEmojiNames, mayCarryKudos } from "./lib/cosmetics";
import { FALLBACK_REACTION } from "./lib/guidance";
import { escapeMrkdwn, isSlackResponseUrl, rewardLine, slackApi, webLink, type SlackResponse } from "./lib/slack";
import { formatCoins } from "./lib/coins";
import { RARITY_SLACK_BADGE, type Rarity } from "./lib/messages";
import { OPEN_COUNT_CAP } from "./lib/store";
import { questBlocks } from "./lib/questBlocks";
import { earningsText } from "./lib/xp";
import { gainBlocks, gainsText } from "./lib/gains";
import { gameBlocks } from "./lib/gameBlocks";
import { seedsToPlantText, stageUpText, treeBlocks } from "./lib/treeView";

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
  thread_ts?: string;
  /** The author's workspace: another one's for people in shared (Slack Connect) channels. */
  user_team?: string;
  tab?: string;
  reaction?: string;
  item_user?: string;
  item?: { type: string; channel: string; ts: string };
  tokens?: { bot?: string[]; oauth?: string[] };
  /** message_changed: the message after the edit (with its original ts), and before it. */
  message?: EditedMessage;
  previous_message?: { text?: string };
};

type EditedMessage = {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  user_team?: string;
  edited?: { user?: string; ts?: string };
};

const IGNORED_SUBTYPES = new Set([
  "message_deleted",
  "bot_message",
  "slackbot_response",
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

    if (event.type === "message" && event.subtype === "message_changed") {
      // An edit can fix a failed kudos attempt. `message` is the edited message, with its original ts.
      const edited = event.message;
      if (!edited?.user || edited.bot_id || typeof edited.text !== "string" || !edited.ts || !event.channel) return null;
      // Unfurls and new thread replies also change a message, but only its author edits it.
      if (!edited.edited) return null;
      if (event.channel_type === "im") return null;
      if (edited.user_team && edited.user_team !== teamId) return null;
      const previousText = event.previous_message?.text;
      if (edited.text === previousText) return null;
      if (!mayCarryKudos(edited.text, emojiName) && !mayCarryKudos(previousText ?? "", emojiName)) return null;
      const channel = await channelInfo(install.botToken, event.channel);
      const result = await ctx.runMutation(internal.kudos.ingestEdit, {
        workspaceId,
        botUserId: install.botUserId,
        giverSlackId: edited.user,
        text: edited.text,
        previousText,
        editTs: edited.edited.ts ?? event.ts ?? edited.ts,
        channelId: event.channel,
        channelName: channel.name,
        channelPrivate: channel.isPrivate,
        messageTs: edited.ts,
        unknownSlackIds: await lookUpUnknownMentions(ctx, install.botToken, workspaceId, teamId, edited.text),
      });
      // A thread's parent carries its own ts as thread_ts; its replies go to the channel.
      const threadTs = edited.thread_ts !== edited.ts ? edited.thread_ts : undefined;
      if (result) await answerAttempt(ctx, install.botToken, teamId, { channel: event.channel, ts: edited.ts, threadTs, user: edited.user }, result);
      return null;
    }

    if (event.type === "message") {
      if (event.bot_id || !event.user || !event.text || !event.channel || !event.ts) return null;
      if (event.subtype && IGNORED_SUBTYPES.has(event.subtype)) return null;
      if (event.channel_type === "im") return null;
      if (event.user_team && event.user_team !== teamId) return null; // guests from other workspaces can't give
      if (!mayCarryKudos(event.text, emojiName)) return null; // who gave it decides what counts
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
        ...(event.thread_ts && event.thread_ts !== event.ts ? { threadTs: event.thread_ts } : {}),
        unknownSlackIds: await lookUpUnknownMentions(ctx, install.botToken, workspaceId, teamId, event.text),
      });
      if (result) await answerAttempt(ctx, install.botToken, teamId, { channel: event.channel, ts: event.ts, threadTs: event.thread_ts, user: event.user }, result);
      return null;
    }

    if (event.type === "reaction_added" || event.type === "reaction_removed") {
      if (!event.user || !event.item_user || !event.reaction || event.item?.type !== "message") return null;
      // The kudos emoji or a game emoji (who reacted decides what counts), or the bot's ✅ in its
      // place: the reactions that give kudos or join a spree.
      const reacted = baseEmojiName(event.reaction);
      const kudosEmoji = kudosEmojiNames(emojiName).includes(reacted);
      if (!kudosEmoji && reacted !== FALLBACK_REACTION) return null;
      if (event.user === install.botUserId) return null;
      if (event.type === "reaction_removed") {
        const left = await ctx.runMutation(internal.kudos.ingestUnreaction, {
          workspaceId,
          reactorSlackId: event.user,
          channelId: event.item.channel,
          messageTs: event.item.ts,
          reaction: event.reaction,
        });
        if (left) await ephemeral(install.botToken, { channel: event.item.channel, threadTs: left.threadTs, user: event.user, text: left.text });
        return null;
      }
      // Only a reaction that may give kudos needs the channel and the message's text; ✅ can only join a spree.
      const giving = kudosEmoji;
      const channel = giving ? await channelInfo(install.botToken, event.item.channel) : {};
      const result = await ctx.runMutation(internal.kudos.ingestReaction, {
        workspaceId,
        botUserId: install.botUserId,
        reaction: event.reaction,
        reactorSlackId: event.user,
        authorSlackId: event.item_user,
        channelId: event.item.channel,
        channelName: channel.name,
        channelPrivate: channel.isPrivate,
        messageTs: event.item.ts,
        messageText: giving ? await messageText(install.botToken, event.item.channel, event.item.ts) : undefined,
      });
      if (result?.spree) {
        const { text, threadTs, attemptId } = result.spree;
        await ephemeral(install.botToken, { channel: event.item.channel, threadTs, user: event.user, text, ...(attemptId ? { actions: spreeButtons(attemptId) } : {}) });
      } else if (result) {
        await deliver(ctx, install.botToken, teamId, result.notificationIds, {
          channel: event.item.channel,
          guidance: result.guidance ? { user: event.user, text: result.guidance } : undefined,
        });
      }
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

/**
 * Looks up mentions Kudos has no member row for. A teammate who just joined is added (so they
 * can receive); ids Slack doesn't know and people from other workspaces come back as unknown.
 */
async function lookUpUnknownMentions(ctx: ActionCtx, token: string, workspaceId: Id<"workspaces">, teamId: string, text: string) {
  const ids = mentionedUsers(text);
  const unknown: string[] = ids.length > 0 ? await ctx.runQuery(internal.kudos.unknownMentions, { workspaceId, slackUserIds: ids }) : [];
  const found = [];
  const missing = [];
  for (const id of unknown) {
    const res = await slackApi(token, "users.info", { user: id });
    const user = res.ok ? (res.user as SlackUser | undefined) : undefined;
    // Only a definite answer makes someone unknown: a failed look-up keeps the benefit of the doubt.
    if (user && (!user.team_id || user.team_id === teamId)) found.push(toMember(user));
    else if (user || res.error === "user_not_found") missing.push(id);
  }
  if (found.length > 0) await ctx.runMutation(internal.slackData.upsertSlackUsers, { workspaceId, users: found });
  return missing;
}

type Ingested = {
  notificationIds: Id<"notifications">[];
  guidance?: string;
  attempt?: { id: Id<"kudosAttempts">; reaction: string; staleReactions?: string[] };
};

/** After a kudos attempt (or an edit of one): the bot's reaction on the message, then the replies. */
async function answerAttempt(
  ctx: ActionCtx,
  token: string,
  teamId: string,
  message: { channel: string; ts: string; threadTs?: string; user: string },
  { attempt, notificationIds, guidance }: Ingested,
) {
  const { channel, ts } = message;
  for (const stale of attempt?.staleReactions ?? []) await unreact(token, channel, ts, stale);
  if (attempt) await react(ctx, token, channel, ts, attempt);
  await deliver(ctx, token, teamId, notificationIds, {
    channel,
    threadTs: message.threadTs,
    guidance: guidance ? { user: message.user, text: guidance } : undefined,
  });
}

/** Join / Not now on a spree prompt (#94); the http interactions route handles the clicks. */
function spreeButtons(attemptId: string) {
  return {
    type: "actions",
    elements: [
      { type: "button", style: "primary", text: { type: "plain_text", text: "Join" }, action_id: "spree_join", value: attemptId },
      { type: "button", text: { type: "plain_text", text: "Not now" }, action_id: "spree_dismiss", value: attemptId },
    ],
  };
}

/** A message only `user` sees, where something happened (in its thread, if any). */
async function ephemeral(token: string, m: { channel: string; threadTs?: string; user: string; text: string; actions?: object }) {
  const blocks = [{ type: "section", text: { type: "mrkdwn", text: m.text } }, ...(m.actions ? [m.actions] : [])];
  const res = await slackApi(token, "chat.postEphemeral", { channel: m.channel, thread_ts: m.threadTs, user: m.user, text: m.text, blocks });
  if (!res.ok) console.warn(`Ephemeral for ${m.user} in ${m.channel} failed: ${res.error}`);
}

/** A spree reached a tier (#94): the public reply in the kudos' thread (§G13). */
export const postInThread = internalAction({
  args: { workspaceId: v.id("workspaces"), channel: v.string(), threadTs: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspaceId, channel, threadTs, text }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (!install) return null;
    const res = await slackApi(install.botToken, "chat.postMessage", { channel, thread_ts: threadTs, text, blocks: [{ type: "section", text: { type: "mrkdwn", text } }] });
    if (!res.ok) console.warn(`Spree reply in ${channel}/${threadTs} failed: ${res.error}`);
    return null;
  },
});

/** Takes the bot's reaction off the message. Already gone is fine; a failure never blocks the rest. */
async function unreact(token: string, channel: string, timestamp: string, name: string) {
  const res = await slackApi(token, "reactions.remove", { channel, timestamp, name });
  if (!res.ok && res.error !== "no_reaction") console.warn(`Removing :${name}: from ${channel}/${timestamp} failed: ${res.error}`);
}

/**
 * Puts the attempt's reaction on the message and records it once Slack shows it. Slack rejects
 * a custom kudos emoji the workspace doesn't have (`invalid_name`): ✅ says "given" then.
 * Reacting twice is fine (`already_reacted`), and a failure (e.g. `missing_scope` before the app
 * is reinstalled) never blocks the replies.
 */
async function react(ctx: ActionCtx, token: string, channel: string, timestamp: string, attempt: { id: Id<"kudosAttempts">; reaction: string }) {
  let name = attempt.reaction;
  let res = await slackApi(token, "reactions.add", { channel, timestamp, name });
  if (res.error === "invalid_name" && name !== FALLBACK_REACTION) {
    name = FALLBACK_REACTION;
    res = await slackApi(token, "reactions.add", { channel, timestamp, name });
  }
  if (res.ok || res.error === "already_reacted") {
    await ctx.runMutation(internal.attempts.setReaction, { id: attempt.id, reaction: name });
  } else {
    console.warn(`Reacting with :${name}: on ${channel}/${timestamp} failed: ${res.error}`);
  }
}

/** Replies only the giver sees, where they gave (game spec §G13: the giver's reply is no DM). */
const EPHEMERAL = new Set(["giver_success", "limit_reached", "self_kudos"]);

/** Where an attempt happened (its thread, if any), and how to fix it if it failed. */
type Attempted = { channel: string; threadTs?: string; guidance?: { user: string; text: string } };

/**
 * Sends queued bot messages. The giver's reply (with what the kudos earned, while the game is on)
 * and "you can't do that" replies are shown ephemerally where the attempt happened, the latter
 * together with the guidance on how to fix it; everything else is a DM. Guidance without such a
 * reply goes out as an ephemeral message of its own.
 */
async function deliver(ctx: ActionCtx, token: string, teamId: string, ids: Id<"notifications">[], where?: Attempted) {
  const { channel, threadTs: thread_ts, guidance } = where ?? {};
  let guided = !guidance || !channel;
  const rows = ids.length > 0 ? await ctx.runQuery(internal.slackData.notificationsForDelivery, { ids }) : [];
  const link = (path: string) => webLink(teamId, path);
  const questLog = link("/quests");
  const gallery = link("/discoveries");
  // Members whose reply fell back to a DM: that DM already shows the message it discovered.
  const repliedByDm = new Set<string>();
  for (const n of rows) {
    if (n.delivery !== "pending") continue;
    const ephemeral = EPHEMERAL.has(n.category) && channel;
    const help = ephemeral && !guided && guidance?.user === n.slackUserId ? guidance.text : null;
    if (help) guided = true;
    // What the member discovered or gained in this event (lib/gains.ts): the whole DM, or after the message.
    const gains = (n.gains ?? []).filter((g) => g.kind !== "discovery" || !repliedByDm.has(n.slackUserId));
    let blocks: object[];
    let text: string;
    if (n.category === "garden") {
      // A plant grown for them (gardens.ts): no rarity, no gallery; a link to their garden.
      const garden = link("/garden");
      blocks = [
        { type: "section", text: { type: "mrkdwn", text: `🌿 ${n.slackText}` } },
        ...(garden ? [{ type: "context", elements: [{ type: "mrkdwn", text: `<${garden}|Your garden>` }] }] : []),
      ];
      text = n.slackText;
    } else if (n.category === "gains" || n.category === "level_up") {
      if (n.gains && gains.length === 0) {
        await ctx.runMutation(internal.slackData.markDelivery, { id: n._id, delivery: "skipped" });
        continue;
      }
      blocks = gains.length > 0 ? gainBlocks(gains, link) : [{ type: "section", text: { type: "mrkdwn", text: n.slackText } }];
      text = gains.length > 0 ? gainsText(gains, "slack") : n.slackText;
    } else {
      const quest = n.questProgress;
      const earned = n.earnings ? `*${earningsText(n.earnings)}*` : null;
      // A Super kudos (#98): the receiver's celebration heads their DM; the giver's note follows what it earned.
      const celebration = n.superKudos?.kind === "celebration" ? n.superKudos.slackText : null;
      const superNote = n.superKudos && n.superKudos.kind !== "celebration" ? n.superKudos.slackText : null;
      // The receiver's seeds to plant at the tree (#154), this kudos' among them.
      const seeds = n.seedsToPlant !== undefined && n.seedsToPlant !== 0 ? `🌱 ${seedsToPlantText(n.seedsToPlant)}` : null;
      const context = [
        RARITY_SLACK_BADGE[n.rarity as Rarity],
        n.isNewDiscovery ? `✨ New discovery! (${n.discoveredCount} collected)` : null,
        quest ? `${quest.completed} of ${quest.available} quests this week` : null,
        quest?.sweep ? "🧹 Clean sweep!" : null,
        seeds,
        quest ? questLog && `<${questLog}|Quest log>` : gallery && `<${gallery}|Message gallery>`,
      ]
        .filter(Boolean)
        .join("  ·  ");
      blocks = [
        ...(celebration ? [{ type: "section", text: { type: "mrkdwn", text: celebration } }] : []),
        { type: "section", text: { type: "mrkdwn", text: n.slackText } },
        ...(earned ? [{ type: "section", text: { type: "mrkdwn", text: earned } }] : []),
        ...(superNote ? [{ type: "section", text: { type: "mrkdwn", text: superNote } }] : []),
        ...(help ? [{ type: "section", text: { type: "mrkdwn", text: help } }] : []),
        { type: "context", elements: [{ type: "mrkdwn", text: context }] },
        ...(gains.length > 0 ? [{ type: "divider" }, ...gainBlocks(gains, link)] : []),
      ];
      text = [celebration, n.slackText, earned, superNote, help, seeds, gains.length > 0 ? gainsText(gains, "slack") : null].filter(Boolean).join("\n");
    }
    let res = ephemeral
      ? await slackApi(token, "chat.postEphemeral", { channel, thread_ts, user: n.slackUserId, text, blocks })
      : await slackApi(token, "chat.postMessage", { channel: n.slackUserId, text, blocks });
    // The giver's reply used to be a DM: if Slack can't show it where they gave, it still reaches them.
    if (ephemeral && !res.ok && n.category === "giver_success") {
      res = await slackApi(token, "chat.postMessage", { channel: n.slackUserId, text, blocks });
      if (res.ok) repliedByDm.add(n.slackUserId);
    }
    await ctx.runMutation(internal.slackData.markDelivery, {
      id: n._id,
      delivery: res.ok ? "sent" : "failed",
      error: res.ok ? undefined : res.error,
    });
  }
  if (!guided && guidance && channel) {
    const blocks = [{ type: "section", text: { type: "mrkdwn", text: guidance.text } }];
    const res = await slackApi(token, "chat.postEphemeral", { channel, thread_ts, user: guidance.user, text: guidance.text, blocks });
    if (!res.ok) console.warn(`Kudos guidance for ${guidance.user} in ${channel} failed: ${res.error}`);
  }
}

async function publishHome(ctx: ActionCtx, workspaceId: Id<"workspaces">, token: string, slackUserId: string) {
  const data = await ctx.runQuery(internal.slackData.homeData, { workspaceId, slackUserId });
  if (!data) return;
  const e = `:${data.emojiName}:`;
  const link = (path: string) => webLink(data.slackTeamId, path);
  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
  const quests = data.quests ? questBlocks(data.quests, link("/quests")) : [];
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
      ...(data.invite
        ? [{ type: "section", text: { type: "mrkdwn", text: `*You can give seeds of appreciation too.* Give a seed: @name ${e} and a few words on why. Your first kudos starts your level.` } }]
        : []),
      { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
      ...actions([linkButton("Open dashboard", "open_dashboard", link("/me"), "primary"), linkButton("Message gallery", "open_gallery", link("/discoveries"))]),
      ...(data.game ? [{ type: "divider" }, ...gameBlocks(data.game, link("/me"))] : []),
      ...(data.tree ? [{ type: "divider" }, ...treeBlocks(data.tree, link("/"))] : []),
      ...(quests.length > 0 ? [{ type: "divider" }, ...quests] : []),
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
      ...storeSection(data.store, link),
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Give a seed of appreciation: mention teammates with ${e} and a few words on why, like \`@ana ${e} thanks for the thorough review\`. Every ${e} gives one kudos to each person you mention.`,
          },
        ],
      },
    ],
  };
  await slackApi(token, "views.publish", { user_id: slackUserId, view });
}

/** `balance` null: an admin below level 5 sees only the requests waiting. */
type StoreHome = { balance: number | null; rewards: { emoji: string; name: string; cost: number }[]; waiting: number | null };

/** A button opening the web app, or none while the site's address isn't configured. */
function linkButton(text: string, action_id: string, url: string | null, style?: "primary") {
  return url ? { type: "button", ...(style ? { style } : {}), text: { type: "plain_text", text }, url, action_id } : null;
}

/** An actions block with the buttons that exist; no block when none do. */
function actions(buttons: (object | null)[]) {
  const elements = buttons.filter((b) => b !== null);
  return elements.length > 0 ? [{ type: "actions", elements }] : [];
}

/** The App Home "Rewards store" section, in Hog coins; nothing at all while real rewards are off. */
function storeSection(store: StoreHome | null, link: (path: string) => string | null) {
  if (!store) return [];
  const { balance } = store;
  const buttons = balance === null ? [] : [linkButton("Open store", "open_store", link("/store"))];
  const fields = balance === null ? [] : [`*Balance*\n${formatCoins(balance)}`];
  if (store.waiting !== null) {
    const count = store.waiting >= OPEN_COUNT_CAP ? `${OPEN_COUNT_CAP - 1}+` : String(store.waiting);
    fields.push(`*For admins*\n${count} ${store.waiting === 1 ? "request" : "requests"} waiting`);
    if (store.waiting > 0) {
      buttons.push(linkButton("Review requests", "review_requests", link("/admin?tab=store")));
    }
  }
  return [
    { type: "divider" },
    { type: "header", text: { type: "plain_text", text: "Rewards store" } },
    { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
    ...(balance === null
      ? []
      : [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              verbatim: true,
              text: store.rewards.map((r) => rewardLine(r, balance)).join("\n") || "_The shelves are empty. Your admins are still stocking the store._",
            },
          },
        ]),
    ...actions(buttons),
  ];
}

/**
 * A bonus day or company-wide booster in the admin's announcement channel (#97, §G13), or a
 * scheduled one called off. The bot must be a member of the channel: `not_in_channel` (and any
 * other error) is recorded for the admin page, and the boost runs anyway.
 */
export const postAnnouncement = internalAction({
  args: { boostId: v.id("boosts"), workspaceId: v.id("workspaces"), kind: v.union(v.literal("start"), v.literal("cancel")), dayKey: v.string(), channelId: v.string() },
  returns: v.null(),
  handler: async (ctx, { channelId, ...args }) => {
    const post = await ctx.runQuery(internal.boosts.announcementForSlack, args);
    const outcome = { boostId: args.boostId, workspaceId: args.workspaceId, dayKey: args.dayKey, channelId };
    if (!post) {
      if (args.kind === "start") await ctx.runMutation(internal.boosts.announced, { ...outcome, outcome: "skipped" });
      return null;
    }
    const res = await slackApi(post.token, "chat.postMessage", { channel: channelId, text: post.text, unfurl_links: false });
    if (!res.ok) console.warn(`Boost announcement in ${channelId} failed: ${res.error}`);
    if (args.kind === "start") {
      await ctx.runMutation(internal.boosts.announced, res.ok ? { ...outcome, outcome: "sent" } : { ...outcome, outcome: "failed", error: res.error ?? "unknown_error" });
    }
    return null;
  },
});

/** Posts the tree's new stage in the announcement channel (#154, tree.ts `announceStage`), once. */
export const postTreeStage = internalAction({
  args: { eventId: v.id("treeEvents") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const post = await ctx.runQuery(internal.tree.stagePost, { eventId });
    if (!post) {
      await ctx.runMutation(internal.tree.stagePosted, { eventId, outcome: "skipped" });
      return null;
    }
    const res = await slackApi(post.token, "chat.postMessage", { channel: post.channelId, text: stageUpText(post.stage), unfurl_links: false });
    if (!res.ok) console.warn(`Tree stage post in ${post.channelId} failed: ${res.error}`);
    await ctx.runMutation(internal.tree.stagePosted, res.ok ? { eventId, outcome: "sent" } : { eventId, outcome: "failed", error: res.error ?? "unknown_error" });
    return null;
  },
});

export const refreshHome = internalAction({
  args: { workspaceId: v.id("workspaces"), slackUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspaceId, slackUserId }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (install) await publishHome(ctx, workspaceId, install.botToken, slackUserId);
    return null;
  },
});

/**
 * Sends DMs queued outside a Slack event (`sendGains` for a skill picked or an item bought on the
 * web, a discovery in a slash command reply): the same delivery as an event's.
 */
export const deliverNotifications = internalAction({
  args: { workspaceId: v.id("workspaces"), ids: v.array(v.id("notifications")) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, ids }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (install) await deliver(ctx, install.botToken, install.workspace.slackTeamId, ids);
    return null;
  },
});

/**
 * The Spotlight capstone (#98): a Super kudos featured in the workspace's announcement channel.
 * The bot must be in that channel; if it isn't, the post fails quietly (the kudos stands).
 */
export const postSpotlight = internalAction({
  args: { superKudosId: v.id("superKudos") },
  returns: v.null(),
  handler: async (ctx, { superKudosId }) => {
    const post = await ctx.runQuery(internal.superKudos.spotlightPost, { superKudosId });
    if (!post) return null;
    // Fail closed: only a kudos Slack confirms was given in a public channel is featured.
    const from = await slackApi(post.botToken, "conversations.info", { channel: post.from });
    if (!from.ok || (from.channel as { is_private?: boolean } | undefined)?.is_private !== false) return null;
    const blocks = [{ type: "section", text: { type: "mrkdwn", text: post.text } }];
    const res = await slackApi(post.botToken, "chat.postMessage", { channel: post.channel, text: post.text, blocks });
    if (!res.ok) console.warn(`postSpotlight: ${res.error}`);
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

const plain = (text: string) => ({ type: "plain_text", text });
const button = (text: string, action_id: string, extra: object) => ({ type: "button", text: plain(text), action_id, ...extra });

const DECIDED = { approved: "✅ Approved", fulfilled: "✔ Fulfilled", declined: "✖ Declined", cancelled: "↩ Cancelled" } as const;

/** Slack renders this in each reader's own time zone ("2 minutes ago"); the fallback is UTC. */
function ago(at: number) {
  const fallback = `${new Date(at).toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return `<!date^${Math.floor(at / 1000)}^{ago}|${fallback}>`;
}

type AdminCopy = {
  redemptionId: Id<"redemptions">;
  slackTeamId: string;
  status: "pending" | keyof typeof DECIDED;
  requester: { slackUserId: string; name: string };
  reward: { name: string; emoji: string; cost: number; legacy: boolean };
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
  const review = webLink(copy.slackTeamId, "/admin?tab=store");
  const item = `*${escapeMrkdwn(`${copy.reward.emoji} ${copy.reward.name}`)}*`;
  const price = copy.reward.legacy ? `${copy.reward.cost} kudos, old Store` : formatCoins(copy.reward.cost);
  const ask = `🛎️ <@${copy.requester.slackUserId}> wants ${item} (${price}).`;
  const answer = copy.answer && `Answer${copy.prompt ? ` to “${escapeMrkdwn(copy.prompt)}”` : ""}: ${escapeMrkdwn(copy.answer)}`;
  const decided = copy.status === "pending" ? null : `${DECIDED[copy.status]} by ${copy.step?.bySlackUserId ? `<@${copy.step.bySlackUserId}>` : "an admin"}`;
  const note = copy.step?.note ? `: “${escapeMrkdwn(copy.step.note)}”` : "";
  const value = copy.redemptionId;
  const buttons = [
    ...(copy.status === "pending" ? [button("Approve", "store_approve", { style: "primary", value })] : []),
    ...(copy.status === "pending" || copy.status === "approved"
      ? [
          button("Mark fulfilled", "store_fulfill", {
            value,
            // Fulfilled is final, so a stray click deserves a second look.
            confirm: {
              title: plain("Mark as fulfilled?"),
              text: plain(`${copy.requester.name.slice(0, 80)} is told it's theirs, and this can't be undone.`),
              confirm: plain("Mark fulfilled"),
              deny: plain("Not yet"),
            },
          }),
        ]
      : []),
  ];
  if (buttons.length > 0 && review) buttons.push(button("Review in Kudos", "store_review", { url: review }));
  const text = decided ? `${ask} ${decided}` : `${ask}${copy.balance ? ` Balance after: ${copy.balance}.` : ""}`;
  return {
    text,
    blocks: [
      { type: "section", text: verbatim(decided ? ask : text) },
      ...(answer ? [{ type: "section", text: verbatim(answer) }] : []),
      ...(copy.isOwn
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: buttons.length > 0 ? "👤 Your own request. You're the only admin who can decide it." : "👤 Your own request." }] }]
        : []),
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
  // balance: the requester's Hog coins right after the step, or null when their wallet isn't shown to them.
  args: { redemptionId: v.id("redemptions"), event: redemptionEventValidator, balance: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event } = args;
    const data = await ctx.runQuery(internal.slackData.redemptionForSlack, { redemptionId: args.redemptionId, withAdmins: event === "requested" });
    if (!data) return null;
    const { botToken: token, requester, reward } = data;
    const item = `*${escapeMrkdwn(`${reward.emoji} ${reward.name}`)}*`;
    const cost = formatCoins(reward.cost);
    // Hog coins are private to the member and admins, whatever received visibility says (ADR 0002),
    // and only shown once the requester's wallet is (level 3, game shown).
    const balance = args.balance === null ? null : formatCoins(args.balance);
    const refunded = reward.legacy
      ? "It was a request from the old kudos Store, so no Hog coins come back."
      : `${cost} ${reward.cost === 1 ? "is" : "are"} back in your balance${balance ? ` (${balance})` : ""}.`;

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
      declined: `${item} was declined by ${by}${note ? `: “${note}”${endsSentence ? "" : "."}` : "."} ${refunded}`,
      cancelled: null, // they did it themselves
    }[event];
    if (update && !requester.deactivated) {
      // The Store page, with My requests, only exists while the game is on.
      const myRequests = data.storeOpen ? webLink(data.slackTeamId, "/store#my-requests") : null;
      const link = myRequests && `Follow it under <${myRequests}|My requests>`;
      await postDm(token, requester.slackUserId, update, [
        { type: "section", text: verbatim(update) },
        ...(link ? [{ type: "context", elements: [{ type: "mrkdwn", text: link }] }] : []),
      ]);
    }

    const copies: { channel: string; ts: string; own?: boolean }[] = [];
    for (const admin of data.admins) {
      const { text, blocks } = adminCopy({
        redemptionId: args.redemptionId,
        slackTeamId: data.slackTeamId,
        status: "pending",
        requester,
        reward,
        prompt: data.prompt,
        answer: data.answer,
        balance,
        isOwn: admin.isOwn,
      });
      const sent = await postDm(token, admin.slackUserId, text, blocks);
      if (sent) copies.push({ ...sent, ...(admin.isOwn ? { own: true } : {}) });
    }
    if (copies.length > 0) await ctx.runMutation(internal.slackData.saveAdminMessages, { redemptionId: args.redemptionId, messages: copies });

    if (!requester.deactivated) await publishHome(ctx, data.workspaceId, token, requester.slackUserId);
    return null;
  },
});

const MAX_SYNC_RETRIES = 3;

/**
 * Rewrites every admin's copy of a request after a step, from the web or from Slack. Syncs can
 * overlap, so each one re-reads the request after updating and goes again if it moved on: the
 * last one to finish always shows the latest state.
 */
export const syncAdminMessages = internalAction({
  args: { redemptionId: v.id("redemptions"), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { redemptionId, attempt = 0 }) => {
    let shown: string | null = null;
    let retryAfter: number | null = null;
    for (let round = 0; round < 3; round++) {
      const data = await ctx.runQuery(internal.slackData.adminCopies, { redemptionId });
      if (!data || data.version === shown) break;
      for (const { channel, ts, own } of data.messages) {
        const { text, blocks } = adminCopy({
          redemptionId,
          slackTeamId: data.slackTeamId,
          status: data.status,
          requester: data.requester,
          reward: data.reward,
          prompt: data.prompt,
          answer: data.answer,
          isOwn: own,
          step: data.step,
        });
        const res = await slackApi(data.botToken, "chat.update", { channel, ts, text, blocks });
        if (res.ok) continue;
        console.warn(`Updating the store DM ${channel}/${ts} failed: ${res.error}`);
        const limited = res.error?.match(/^ratelimited(?: \(retry after (\d+)s\))?/);
        if (limited) retryAfter = Math.max(retryAfter ?? 0, Number(limited[1] ?? 30));
      }
      shown = data.version;
    }
    // Slack asked us to slow down: go again later rather than leave a copy offering stale buttons.
    if (retryAfter !== null && attempt < MAX_SYNC_RETRIES) {
      await ctx.scheduler.runAfter(retryAfter * 1000, internal.slack.syncAdminMessages, { redemptionId, attempt: attempt + 1 });
    }
    return null;
  },
});

/**
 * Rewrites the admins' review DMs of a request whose requester was removed (`removal.ts`), which
 * deleted the request: no buttons are left to click, and the copy no longer names them.
 */
export const retireAdminMessages = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    reward: v.object({ name: v.string(), emoji: v.string() }),
    messages: v.array(v.object({ channel: v.string(), ts: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, { workspaceId, reward, messages }) => {
    const install = await ctx.runQuery(internal.slackData.installationForWorkspace, { workspaceId });
    if (!install) return null;
    const text = `🗑️ This request for *${escapeMrkdwn(`${reward.emoji} ${reward.name}`)}* is gone: its requester was removed from Kudos.`;
    for (const { channel, ts } of messages) {
      const res = await slackApi(install.botToken, "chat.update", { channel, ts, text, blocks: [{ type: "section", text: verbatim(text) }] });
      if (!res.ok) console.warn(`Retiring the store DM ${channel}/${ts} failed: ${res.error}`);
    }
    return null;
  },
});

/** Answers an interaction with a message only the person who clicked sees. */
export const respond = internalAction({
  args: {
    responseUrl: v.string(),
    text: v.string(),
    /** Replace the message the button was on (a spree prompt after Join), or delete it (Not now). */
    original: v.optional(v.union(v.literal("replace"), v.literal("delete"))),
  },
  returns: v.null(),
  handler: async (_ctx, { responseUrl, text, original }) => {
    if (!isSlackResponseUrl(responseUrl)) return null;
    const body =
      original === "delete"
        ? { delete_original: true }
        : { response_type: "ephemeral", replace_original: original === "replace", text };
    try {
      const res = await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
