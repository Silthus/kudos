import type { ChannelMessage } from "./slackMessages";

export type SlackUser = {
  id: string;
  team_id: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  tz?: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string; email?: string; title?: string; image_72?: string; image_192?: string };
};

export type SlackUserGroup = {
  id: string;
  team_id: string;
  handle: string;
  name: string;
  date_delete: number;
  auto_type: "admin" | "owner" | null;
  users: string[];
};

export type UserGroupOptions = { handle?: string; name?: string; users?: string[]; disabled?: boolean; autoType?: "admin" | "owner" };

export type SlackArgs = Record<string, unknown>;

export type SlackCall = { method: string; args: SlackArgs };

export type PostedMessage = { channel: string; ts: string; threadTs?: string; text: string };

export type ScriptedAnswer = (answerAsSlackWould: () => Response) => Response | Promise<Response>;

export const slackError = (error: string): ScriptedAnswer => () => Response.json({ ok: false, error });
export const httpStatus = (status: number): ScriptedAnswer => () => new Response("upstream trouble", { status });
export const rateLimitedFor = (seconds: number): ScriptedAnswer => () =>
  Response.json({ ok: false, error: "ratelimited" }, { status: 429, headers: { "retry-after": String(seconds) } });
export const networkFailure: ScriptedAnswer = () => {
  throw new TypeError("fetch failed");
};
export const timesOut: ScriptedAnswer = () => {
  throw new DOMException("The operation timed out.", "TimeoutError");
};
export const landsButTimesOut: ScriptedAnswer = (answerAsSlackWould) => {
  answerAsSlackWould();
  return timesOut(answerAsSlackWould);
};

export class FakeSlack {
  readonly calls: SlackCall[] = [];
  private readonly users = new Map<string, SlackUser>();
  private readonly userGroups = new Map<string, SlackUserGroup>();
  private readonly joinTimes = new Map<string, number>();
  private readonly reactionsByMessage = new Map<string, string[]>();
  private readonly posted: PostedMessage[] = [];
  private readonly homes = new Map<string, unknown>();
  private readonly scripted = new Map<string, ScriptedAnswer[]>();
  private readonly callTimes = new Map<SlackCall, number>();
  private readonly holds: Array<{ method: string; about: string; meanwhile: () => Promise<void> }> = [];
  private readonly channelMessages = new Map<string, ChannelMessage[]>();
  private workspaceUrl = "https://t1.slack.com/";

  withWorkspaceUrl(url: string) {
    this.workspaceUrl = url;
    return this;
  }

  withMember(id: string, options: Partial<SlackUser> = {}) {
    this.users.set(id, { id, team_id: "T1", ...options });
    return this;
  }

  withUserGroup(id: string, { handle = id.toLowerCase(), name = handle, users = [], disabled = false, autoType }: UserGroupOptions = {}) {
    this.userGroups.set(id, { id, team_id: "T1", handle, name, date_delete: disabled ? 1760349600 : 0, auto_type: autoType ?? null, users });
    return this;
  }

  withoutUserGroup(id: string) {
    this.userGroups.delete(id);
    return this;
  }

  withMessage(channel: string, message: ChannelMessage) {
    this.channelMessages.set(channel, [...(this.channelMessages.get(channel) ?? []), message]);
    return this;
  }

  joiningAt(id: string, at: Date, options: Partial<SlackUser> = {}) {
    this.joinTimes.set(id, at.getTime());
    return this.withMember(id, options);
  }

  answering(method: string, ...answers: ScriptedAnswer[]) {
    this.scripted.set(method, [...(this.scripted.get(method) ?? []), ...answers]);
    return this;
  }

  holdingBack(method: string, about: string, meanwhile: () => Promise<void>) {
    this.holds.push({ method, about, meanwhile });
    return this;
  }

  holdNext(method: string) {
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    let signalReached = () => {};
    const reached = new Promise<void>((resolve) => (signalReached = resolve));
    this.answering(method, async (answerAsSlackWould) => {
      signalReached();
      await released;
      return answerAsSlackWould();
    });
    return { reached, release };
  }

  removeReaction(channel: string, ts: string, name: string) {
    this.setReactions(channel, ts, this.reactionsOn(channel, ts).filter((reaction) => reaction !== name));
  }

  reactionsOn(channel: string, ts: string) {
    return this.reactionsByMessage.get(`${channel}/${ts}`) ?? [];
  }

  messagesIn(channel: string) {
    return this.posted.filter((message) => message.channel === channel);
  }

  homeShownTo(user: string) {
    return this.homes.get(user);
  }

  ephemeralsTo(user: string) {
    return this.callsTo("chat.postEphemeral").filter((args) => args.user === user);
  }

  callsTo(method: string) {
    return this.calls.filter((call) => call.method === method).map((call) => call.args);
  }

  timesOf(method: string, matching: (args: SlackArgs) => boolean = () => true) {
    return this.calls.filter((call) => call.method === method && matching(call.args)).map((call) => this.callTimes.get(call)!);
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = url.pathname.split("/").pop() ?? "";
    const args: SlackArgs = init?.body ? JSON.parse(String(init.body)) : Object.fromEntries(url.searchParams);
    await this.releaseHold(method, args);
    const call = { method, args };
    this.calls.push(call);
    this.callTimes.set(call, Date.now());
    const answerAsSlackWould = () => Response.json(this.answer(method, args));
    const scripted = this.scripted.get(method)?.shift();
    return scripted ? scripted(answerAsSlackWould) : answerAsSlackWould();
  };

  private async releaseHold(method: string, args: SlackArgs) {
    const index = this.holds.findIndex((hold) => hold.method === method && (args.name ?? args.user ?? args.channel) === hold.about);
    if (index === -1) return;
    const [hold] = this.holds.splice(index, 1);
    await hold!.meanwhile();
  }

  private answer(method: string, args: SlackArgs) {
    const field = (name: string) => String(args[name] ?? "");
    if (method === "users.info") {
      const user = this.users.get(field("user"));
      const hasJoined = Date.now() >= (this.joinTimes.get(field("user")) ?? 0);
      return user && hasJoined ? { ok: true, user } : { ok: false, error: "user_not_found" };
    }
    if (method === "users.list") return { ok: true, members: [...this.users.values()], response_metadata: { next_cursor: "" } };
    if (method === "usergroups.list") return { ok: true, usergroups: this.userGroupsListed(args) };
    if (method === "usergroups.users.list") {
      const group = this.userGroups.get(field("usergroup"));
      return group ? { ok: true, users: group.users } : { ok: false, error: "no_such_subteam" };
    }
    if (method === "reactions.add") {
      const reactions = this.reactionsOn(field("channel"), field("timestamp"));
      if (reactions.includes(field("name"))) return { ok: false, error: "already_reacted" };
      this.setReactions(field("channel"), field("timestamp"), [...reactions, field("name")]);
      return { ok: true };
    }
    if (method === "reactions.remove") {
      const reactions = this.reactionsOn(field("channel"), field("timestamp"));
      if (!reactions.includes(field("name"))) return { ok: false, error: "no_reaction" };
      this.removeReaction(field("channel"), field("timestamp"), field("name"));
      return { ok: true };
    }
    if (method === "chat.postEphemeral") return { ok: true, message_ts: "1760349700.000100" };
    if (method === "views.publish") {
      this.homes.set(field("user_id"), args.view);
      return { ok: true };
    }
    if (method === "chat.postMessage") return this.postMessage(args);
    if (method === "chat.update") return this.updateMessage(args);
    if (method === "conversations.history") return this.history(args);
    if (method === "conversations.replies") return this.replies(args);
    if (method === "conversations.join") return { ok: true, channel: { id: field("channel") } };
    if (method === "auth.test") return { ok: true, url: this.workspaceUrl, team: "Kudos Test", team_id: "T1", user: "kudos", user_id: "U_KUDOS_BOT", bot_id: "B_KUDOS" };
    return { ok: false, error: "unknown_method" };
  }

  private userGroupsListed(args: SlackArgs) {
    const groups = [...this.userGroups.values()].filter((group) => args.include_disabled === "true" || group.date_delete === 0);
    return groups.map(({ users, ...group }) => ({
      ...group,
      ...(args.include_users === "true" && { users }),
      ...(args.include_count === "true" && { user_count: users.length }),
    }));
  }

  private postMessage(args: SlackArgs) {
    const channel = String(args.channel);
    const ts = `1760349700.${String(100 + this.posted.length).padStart(6, "0")}`;
    this.posted.push({ channel, ts, ...(args.thread_ts !== undefined && { threadTs: String(args.thread_ts) }), text: String(args.text) });
    return { ok: true, channel, ts };
  }

  private updateMessage(args: SlackArgs) {
    const message = this.posted.find(({ channel, ts }) => channel === args.channel && ts === args.ts);
    if (message === undefined) return { ok: false, error: "message_not_found" };
    message.text = String(args.text);
    return { ok: true, channel: message.channel, ts: message.ts };
  }

  private history(args: SlackArgs) {
    const topLevel = this.messagesOf(String(args.channel)).filter((message) => message.thread_ts === undefined || message.thread_ts === message.ts);
    const newestFirst = topLevel.filter((message) => isWithin(message.ts, args)).sort((a, b) => order(b.ts) - order(a.ts));
    return { ok: true, messages: newestFirst.slice(0, Number(args.limit ?? 100)), has_more: false };
  }

  private replies(args: SlackArgs) {
    const root = String(args.ts);
    const thread = this.messagesOf(String(args.channel)).filter((message) => message.ts === root || message.thread_ts === root);
    const parent = thread.find((message) => message.ts === root);
    if (parent === undefined) return { ok: false, error: "thread_not_found" };
    const replies = thread.filter((message) => message.ts !== root && isWithin(message.ts, args)).sort((a, b) => order(a.ts) - order(b.ts));
    return { ok: true, messages: [parent, ...replies], has_more: false };
  }

  private messagesOf(channel: string) {
    return this.channelMessages.get(channel) ?? [];
  }

  private setReactions(channel: string, ts: string, reactions: string[]) {
    this.reactionsByMessage.set(`${channel}/${ts}`, reactions);
  }
}

function isWithin(ts: string, { oldest, latest, inclusive }: SlackArgs) {
  const [from, to, at] = [order(String(oldest ?? "0")), order(String(latest ?? "9999999999.999999")), order(ts)];
  return inclusive === "true" ? from <= at && at <= to : from < at && at < to;
}

function order(ts: string) {
  const [seconds = "0", fraction = ""] = ts.split(".");
  return Number(seconds) * 1_000_000 + Number(fraction.padEnd(6, "0").slice(0, 6));
}

export function isWelcome(args: SlackArgs) {
  return String(args.text).includes("Welcome to HedgeHug");
}
