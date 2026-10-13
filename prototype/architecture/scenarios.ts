// PROTOTYPE (throwaway, never merged): drives Slack-shaped envelopes through the adapter seam
// into the kudos engine and prints the state after every step.
// Run: node prototype/architecture/scenarios.ts

import type {
  ChatUserId,
  ParseHook,
  Indicator,
  MemberFacts,
  MemberId,
  Observation,
  Reply,
  WorkspaceId,
} from "./contracts.ts";
import { createKudosEngine, emptyTables, messageKey } from "./engine.ts";
import { combinePerks, createEventBus, type Job, type PerkContributor, type Subscriptions } from "./events.ts";
import { createKudosParser, workspaceEmojiHook } from "./parser.ts";
import { reconcileIndicator } from "./reconcile-indicator.ts";
import { normalize, type SlackEnvelope } from "./slack-normalize.ts";

const TEAM = "T1";
const CHANNEL = "C1";

type Wiring = {
  subscriptions?: (log: string[]) => Subscriptions;
  perkContributors?: PerkContributor[];
  parseHooks?: ParseHook[];
};

const defaultSubscriptions = (log: string[]): Subscriptions => ({
  kudosGiven: [
    { name: "progression", handle: (e) => log.push(`progression: ${e.giver} gave ${e.awards.length} award(s)`) },
    { name: "leaderboard", handle: (e) => log.push(`leaderboard: +${e.awards.map((a) => `${a.recipient}×${a.kudos}`).join(",")}`) },
  ],
});

function harness(wiring: Wiring = {}) {
  const people = new Map<string, MemberFacts>([
    ["UALICE", { kind: "member", member: "m-alice" as MemberId, timeZone: "Europe/Berlin" }],
    ["UBOB", { kind: "member", member: "m-bob" as MemberId, timeZone: "America/New_York" }],
    ["UCAROL", { kind: "member", member: "m-carol" as MemberId, timeZone: undefined }],
    ["UBOT", { kind: "bot" }],
    ["UEXT", { kind: "not-a-member" }],
  ]);
  const indicators = new Map<string, { desired: Indicator; version: number }>();
  const replies: Array<{ to: ChatUserId; thread?: string; reply: Reply["kind"] }> = [];
  const subscriberLog: string[] = [];
  const scheduled: Job[] = [];
  const receipts = new Set<string>();
  const slackReactions = new Map<string, Set<string>>();
  const tables = emptyTables();
  let failNextDelivery = false;

  const settings = { of: () => ({ baseAllowance: 3, kudosEmoji: "taco" }) };
  const engine = createKudosEngine({
    directory: { lookup: (_workspace, user) => people.get(user) },
    settings,
    parser: createKudosParser([workspaceEmojiHook(settings), ...(wiring.parseHooks ?? [])]),
    perks: combinePerks(wiring.perkContributors ?? []),
    feedback: {
      setIndicator: (ref, desired) => {
        const key = messageKey(ref);
        indicators.set(key, { desired, version: (indicators.get(key)?.version ?? 0) + 1 });
      },
      replyPrivately: (_ref, thread, to, reply) => replies.push({ to, thread, reply: reply.kind }),
    },
    events: createEventBus((wiring.subscriptions ?? defaultSubscriptions)(subscriberLog), (job) => scheduled.push(job)),
    tables,
  });

  function ingest(envelope: SlackEnvelope): Observation | "duplicate delivery" | "not a message for the engine" {
    const { receiptKey, event } = normalize(envelope);
    if (receipts.has(receiptKey)) return "duplicate delivery";
    receipts.add(receiptKey);
    if (!event) return "not a message for the engine";
    const observation = engine.observe(event);
    runScheduledJobs();
    return observation;
  }

  function runScheduledJobs() {
    for (const job of scheduled.splice(0)) {
      try {
        job.run();
      } catch (error) {
        subscriberLog.push(`${job.subscriber} FAILED: ${(error as Error).message} (award untouched, other subscribers still ran)`);
      }
    }
  }

  function deliver() {
    for (const [key, { desired }] of indicators) {
      if (failNextDelivery) {
        failNextDelivery = false;
        throw new Error("Slack timed out");
      }
      const own = slackReactions.get(key) ?? new Set<string>();
      for (const { op, emoji } of reconcileIndicator(desired, own)) op === "add" ? own.add(emoji) : own.delete(emoji);
      slackReactions.set(key, own);
    }
  }

  function state() {
    return {
      awards: tables.awards.map((a) => `${a.giver}→${a.recipient} ×${a.kudos} (${a.day})`),
      spent: Object.fromEntries(tables.spent),
      messages: Object.fromEntries([...tables.messages].map(([k, r]) => [k.split("/").pop(), `${r.state} @rev ${r.revision}`])),
      storedText: [...tables.messages.values()].some((record) => JSON.stringify(record, (_k, v) => (typeof v === "bigint" ? 0 : v)).includes("great demo")),
      slackReactions: Object.fromEntries([...slackReactions].map(([k, v]) => [k.split("/").pop(), [...v]])),
      replies: replies.map((r) => `${r.reply} → ${r.to}${r.thread ? ` (thread ${r.thread})` : ""}`),
      subscribers: subscriberLog,
    };
  }

  return {
    ingest,
    deliver,
    state,
    learn: (user: string, facts: MemberFacts) => people.set(user, facts),
    recheck: (ts: string) => {
      const observation = engine.recheck({ workspace: TEAM as WorkspaceId, conversation: CHANNEL, message: ts });
      runScheduledJobs();
      return observation;
    },
    failNextDelivery: () => (failNextDelivery = true),
  };
}

type Part = string;

function rich(...parts: Part[]) {
  const elements = parts.map((part) => {
    if (part.startsWith("@")) return { type: "user", user_id: part.slice(1) };
    if (part === "!here") return { type: "broadcast", range: "here" };
    if (part === "!group") return { type: "usergroup", usergroup_id: "S1" };
    if (part.startsWith(":")) return { type: "emoji", name: part.slice(1, -1) };
    if (part.startsWith("~")) return { type: "emoji", name: part.slice(2, -1), style: { strike: true } };
    return { type: "text", text: part };
  });
  return [{ type: "rich_text", elements: [{ type: "rich_text_section", elements }] }];
}

function post(eventId: string, ts: string, user: string, parts: Part[], extra: { thread_ts?: string; subtype?: string } = {}): SlackEnvelope {
  return {
    type: "event_callback" as const,
    event_id: eventId,
    team_id: TEAM,
    event: { type: "message", channel: CHANNEL, channel_type: "channel", user, ts, blocks: rich(...parts), ...extra },
  };
}

function edit(eventId: string, editTs: string | undefined, originalTs: string, user: string, parts: Part[], eventTs = editTs ?? "0"): SlackEnvelope {
  return {
    type: "event_callback" as const,
    event_id: eventId,
    team_id: TEAM,
    event: {
      type: "message",
      subtype: "message_changed",
      channel: CHANNEL,
      channel_type: "channel",
      ts: eventTs,
      message: { user, ts: originalTs, blocks: rich(...parts), ...(editTs ? { edited: { ts: editTs } } : {}) },
    },
  };
}

const wiringFor: Record<string, Wiring> = {
  "13. a failing subscriber blocks neither the award nor the other subscribers": {
    subscriptions: (log) => ({
      kudosGiven: [
        ...defaultSubscriptions(log).kudosGiven,
        { name: "achievements", handle: () => { throw new Error("bug in achievements"); } },
      ],
    }),
  },
  "14. plug-ins: a perk raises the allowance, a parse hook makes an unlocked :star: worth 2": {
    perkContributors: [{ name: "progression", perksOf: () => ({ allowanceBonus: 1 }) }],
    parseHooks: [
      { name: "unlocked emoji", kudosEmoji: ({ giver }) => (giver === "m-alice" ? [{ name: "star", kudos: 2 }] : []) },
    ],
  },
  "15. an annotation hook reads the note; the fact travels with kudosGiven, the text is never stored": {
    parseHooks: [{ name: "note words", annotate: (content) => ({ noteWords: content.text.split(/\s+/).filter(Boolean).length }) }],
    subscriptions: (log) => ({
      kudosGiven: [{ name: "mindfulness assessor (later)", handle: (e) => log.push(`assessor sees annotations ${JSON.stringify(e.annotations)}`) }],
    }),
  },
};

const scenarios: Record<string, (h: ReturnType<typeof harness>) => unknown[]> = {
  "1. happy path with skipped mentions": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", "@UALICE", "@UBOT", "!here", ":taco:", ":taco:"])),
  ],
  "2. a delivery receipt is deduped apart from the attempt": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
    h.ingest(post("Ev1-redelivered-with-new-id", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
  ],
  "3. over allowance, then a retry by edit swaps the reaction": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", "@UCAROL", ":taco:", ":taco:"])),
    (h.deliver(), "delivered"),
    h.ingest(edit("Ev2", "1760000060.000100", "1760000000.000100", "UALICE", ["@UBOB", ":taco:", ":taco:"])),
    (h.deliver(), "delivered"),
  ],
  "4. an edit arrives before its original; the original is stale": (h) => [
    h.ingest(edit("Ev2", "1760000060.000100", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:", ":taco:", ":taco:"])),
  ],
  "5. newest revision wins: a withdrawal beats a late older retry": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", "@UCAROL", ":taco:", ":taco:"])),
    h.ingest(edit("Ev3", "1760000120.000100", "1760000000.000100", "UALICE", ["@UBOB", "thanks!"])),
    h.ingest(edit("Ev2", "1760000060.000100", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
  ],
  "6. edits to a given message: prose ignored, mentions told": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:", "great demo"])),
    h.ingest(edit("Ev2", "1760000060.000100", "1760000000.000100", "UALICE", ["@UBOB", ":taco:", "great demo!!"])),
    h.ingest(edit("Ev3", "1760000120.000100", "1760000000.000100", "UALICE", ["@UBOB", "@UCAROL", ":taco:"])),
  ],
  "7. metadata-only change and a thread parent's reply metadata are ignored": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
    h.ingest(edit("Ev2", undefined, "1760000000.000100", "UALICE", ["@UBOB", ":taco:"], "1760000300.000100")),
  ],
  "8. a thread reply also sent to the channel counts once, feedback in the thread": (h) => [
    h.ingest(post("Ev1", "1760000500.000100", "UALICE", ["@UBOB", ":taco:"], { thread_ts: "1760000000.000100", subtype: "thread_broadcast" })),
    h.ingest(edit("Ev2", undefined, "1760000000.000100", "UCAROL", ["root message"], "1760000500.000200")),
  ],
  "9. an unverifiable recipient waits, then is given on the posted day": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UDAVE", ":taco:"])),
    h.recheck("1760000000.000100"),
    (h.learn("UDAVE", { kind: "member", member: "m-dave" as MemberId, timeZone: undefined }), "directory learned UDAVE"),
    h.recheck("1760000000.000100"),
  ],
  "10. an unverifiable recipient is abandoned after bounded retries": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UGHOST", ":taco:"])),
    ...Array.from({ length: 5 }, () => h.recheck("1760000000.000100")),
  ],
  "11. feedback failing after the award never awards twice": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
    (h.failNextDelivery(), "Slack will time out"),
    (() => {
      try {
        h.deliver();
        return "delivered";
      } catch (error) {
        return `delivery failed: ${(error as Error).message}`;
      }
    })(),
    (h.deliver(), "delivery retried"),
  ],
  "12. struck-through emoji and an external mention do not count": (h) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UEXT", "~:taco:", "@UBOB"])),
    h.ingest(post("Ev2", "1760000001.000100", "UALICE", ["@UEXT", ":taco:"])),
  ],
};

Object.assign(scenarios, {
  "13. a failing subscriber blocks neither the award nor the other subscribers": (h: ReturnType<typeof harness>) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:"])),
  ],
  "14. plug-ins: a perk raises the allowance, a parse hook makes an unlocked :star: worth 2": (h: ReturnType<typeof harness>) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:", ":star:"])),
    h.ingest(post("Ev2", "1760000001.000100", "UBOB", ["@UALICE", ":star:"])),
  ],
  "15. an annotation hook reads the note; the fact travels with kudosGiven, the text is never stored": (h: ReturnType<typeof harness>) => [
    h.ingest(post("Ev1", "1760000000.000100", "UALICE", ["@UBOB", ":taco:", " great demo of the new onboarding flow"])),
  ],
});

const replacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);
for (const [name, run] of Object.entries(scenarios)) {
  const h = harness(wiringFor[name]);
  console.log(`\n=== ${name}`);
  for (const step of run(h)) console.log("  →", JSON.stringify(step, replacer));
  console.log("  state:", JSON.stringify(h.state(), replacer, 2).replaceAll("\n", "\n  "));
}
