export type SlackUser = {
  id: string;
  team_id: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  tz?: string;
};

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
  private readonly joinTimes = new Map<string, number>();
  private readonly reactionsByMessage = new Map<string, string[]>();
  private readonly posted: PostedMessage[] = [];
  private readonly homes = new Map<string, unknown>();
  private readonly scripted = new Map<string, ScriptedAnswer[]>();
  private readonly callTimes = new Map<SlackCall, number>();
  private readonly holds: Array<{ method: string; about: string; meanwhile: () => Promise<void> }> = [];

  withMember(id: string, options: Partial<SlackUser> = {}) {
    this.users.set(id, { id, team_id: "T1", ...options });
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
    if (method === "conversations.join") return { ok: true, channel: { id: field("channel") } };
    return { ok: false, error: "unknown_method" };
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

  private setReactions(channel: string, ts: string, reactions: string[]) {
    this.reactionsByMessage.set(`${channel}/${ts}`, reactions);
  }
}
