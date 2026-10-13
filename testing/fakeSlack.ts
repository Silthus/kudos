export type SlackUser = {
  id: string;
  team_id: string;
  deleted?: boolean;
  is_bot?: boolean;
  tz?: string;
};

export type SlackCall = { method: string; args: Record<string, string> };

export type ScriptedAnswer = () => Response;

export class FakeSlack {
  readonly calls: SlackCall[] = [];
  private readonly users = new Map<string, SlackUser>();
  private readonly reactionsByMessage = new Map<string, string[]>();
  private readonly scripted = new Map<string, ScriptedAnswer[]>();
  private readonly callTimes = new Map<SlackCall, number>();

  withMember(id: string, options: Partial<SlackUser> = {}) {
    this.users.set(id, { id, team_id: "T1", ...options });
    return this;
  }

  answering(method: string, ...answers: ScriptedAnswer[]) {
    this.scripted.set(method, answers);
    return this;
  }

  reactionsOn(channel: string, ts: string) {
    return this.reactionsByMessage.get(`${channel}/${ts}`) ?? [];
  }

  ephemeralsTo(user: string) {
    return this.callsTo("chat.postEphemeral").filter((args) => args.user === user);
  }

  callsTo(method: string) {
    return this.calls.filter((call) => call.method === method).map((call) => call.args);
  }

  timesOf(method: string, matching: (args: Record<string, string>) => boolean) {
    return this.calls.filter((call) => call.method === method && matching(call.args)).map((call) => this.callTimes.get(call)!);
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = url.pathname.split("/").pop() ?? "";
    const args = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : Object.fromEntries(url.searchParams);
    const call = { method, args };
    this.calls.push(call);
    this.callTimes.set(call, Date.now());
    const scripted = this.scripted.get(method)?.shift();
    return scripted ? scripted() : Response.json(this.answer(method, args));
  };

  private answer(method: string, args: Record<string, string>) {
    if (method === "users.info") {
      const user = this.users.get(args.user ?? "");
      return user ? { ok: true, user } : { ok: false, error: "user_not_found" };
    }
    if (method === "reactions.add") {
      const key = `${args.channel}/${args.timestamp}`;
      const reactions = this.reactionsByMessage.get(key) ?? [];
      if (reactions.includes(args.name ?? "")) return { ok: false, error: "already_reacted" };
      this.reactionsByMessage.set(key, [...reactions, args.name ?? ""]);
      return { ok: true };
    }
    if (method === "reactions.remove") {
      const key = `${args.channel}/${args.timestamp}`;
      const reactions = this.reactionsByMessage.get(key) ?? [];
      if (!reactions.includes(args.name ?? "")) return { ok: false, error: "no_reaction" };
      this.reactionsByMessage.set(key, reactions.filter((name) => name !== args.name));
      return { ok: true };
    }
    if (method === "chat.postEphemeral") return { ok: true, message_ts: "1760349700.000100" };
    if (method === "views.publish") return { ok: true };
    if (method === "chat.postMessage") return { ok: true, channel: args.channel, ts: "1760349700.000100" };
    return { ok: false, error: "unknown_method" };
  }
}
