export type SlackUser = {
  id: string;
  team_id: string;
  deleted?: boolean;
  is_bot?: boolean;
  tz?: string;
};

export type SlackCall = { method: string; args: Record<string, string> };

export type SlackFailure =
  | { error: string }
  | { rateLimitedForSeconds: number }
  | { httpStatus: number }
  | { timeout: true }
  | { timeoutAfterApplying: true };

export class FakeSlack {
  readonly calls: SlackCall[] = [];
  private readonly callTimes: number[] = [];
  private readonly users = new Map<string, SlackUser>();
  private readonly reactionsByMessage = new Map<string, string[]>();
  private readonly failuresByMethod = new Map<string, SlackFailure[]>();

  withMember(id: string, options: Partial<SlackUser> = {}) {
    this.users.set(id, { id, team_id: "T1", ...options });
    return this;
  }

  failNext(method: string, failure: SlackFailure, times = 1) {
    const failures = this.failuresByMethod.get(method) ?? [];
    this.failuresByMethod.set(method, [...failures, ...Array.from({ length: times }, () => failure)]);
    return this;
  }

  removeReaction(channel: string, ts: string, name: string) {
    this.setReactions(channel, ts, this.reactionsOn(channel, ts).filter((reaction) => reaction !== name));
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

  timesOfCallsTo(method: string) {
    return this.calls.flatMap((call, index) => (call.method === method ? [this.callTimes[index]!] : []));
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = url.pathname.split("/").pop() ?? "";
    const args = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : Object.fromEntries(url.searchParams);
    this.calls.push({ method, args });
    this.callTimes.push(Date.now());
    const failure = this.failuresByMethod.get(method)?.shift();
    if (failure === undefined) return Response.json(this.answer(method, args));
    return this.fail(failure, method, args);
  };

  private fail(failure: SlackFailure, method: string, args: Record<string, string>) {
    if ("error" in failure) return Response.json({ ok: false, error: failure.error });
    if ("rateLimitedForSeconds" in failure) {
      return Response.json({ ok: false, error: "ratelimited" }, { status: 429, headers: { "retry-after": String(failure.rateLimitedForSeconds) } });
    }
    if ("httpStatus" in failure) return new Response("upstream trouble", { status: failure.httpStatus });
    if ("timeoutAfterApplying" in failure) this.answer(method, args);
    throw new DOMException("The operation timed out.", "TimeoutError");
  }

  private answer(method: string, args: Record<string, string>) {
    if (method === "users.info") {
      const user = this.users.get(args.user ?? "");
      return user ? { ok: true, user } : { ok: false, error: "user_not_found" };
    }
    if (method === "reactions.add") {
      const reactions = this.reactionsOn(args.channel ?? "", args.timestamp ?? "");
      if (reactions.includes(args.name ?? "")) return { ok: false, error: "already_reacted" };
      this.setReactions(args.channel ?? "", args.timestamp ?? "", [...reactions, args.name ?? ""]);
      return { ok: true };
    }
    if (method === "reactions.remove") {
      const reactions = this.reactionsOn(args.channel ?? "", args.timestamp ?? "");
      if (!reactions.includes(args.name ?? "")) return { ok: false, error: "no_reaction" };
      this.removeReaction(args.channel ?? "", args.timestamp ?? "", args.name ?? "");
      return { ok: true };
    }
    if (method === "chat.postEphemeral") return { ok: true, message_ts: "1760349700.000100" };
    return { ok: false, error: "unknown_method" };
  }

  private setReactions(channel: string, ts: string, reactions: string[]) {
    this.reactionsByMessage.set(`${channel}/${ts}`, reactions);
  }
}
