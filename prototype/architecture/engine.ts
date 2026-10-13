// PROTOTYPE (throwaway, never merged): an in-memory kudos engine behind the KudosEngine interface.
// In Convex, `observe` and `recheck` are internal mutations and the Maps below are tables.

import type {
  Award,
  ChatUserId,
  DayKey,
  Directory,
  EventBus,
  Feedback,
  KudosEmojiValue,
  KudosEngine,
  KudosMessage,
  KudosParser,
  MemberFacts,
  MemberId,
  Mention,
  MessageEvent,
  MessageRef,
  Observation,
  Outcome,
  Perks,
  Revision,
  Settings,
  SkippedMention,
} from "./contracts.ts";

export const VERIFY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];

type MessageState =
  | "watermark"
  | "awaiting-directory"
  | "abandoned"
  | "given"
  | "over-allowance"
  | "invalid"
  | "withdrawn";

type MessageRecord = {
  ref: MessageRef;
  threadRoot: string | undefined;
  author: ChatUserId;
  revision: Revision;
  fingerprint: string;
  state: MessageState;
  parsed: KudosMessage | null;
  spendsAt: number;
  verifyTries: number;
};

export type EngineTables = {
  messages: Map<string, MessageRecord>;
  awards: Array<Award & { message: string; day: DayKey }>;
  spent: Map<string, number>;
  spentWeekly: Map<string, number>;
};

export function emptyTables(): EngineTables {
  return { messages: new Map(), awards: [], spent: new Map(), spentWeekly: new Map() };
}

type Ports = {
  directory: Directory;
  settings: Settings;
  parser: KudosParser;
  perks: Perks;
  feedback: Feedback;
  events: EventBus;
  tables: EngineTables;
};

type Giver = Extract<MemberFacts, { kind: "member" }>;

export function createKudosEngine(ports: Ports): KudosEngine {
  const { directory, settings, parser, perks, feedback, events, tables } = ports;

  function observe(event: MessageEvent): Observation {
    const existing = tables.messages.get(messageKey(event.ref));
    if (existing && event.revision <= existing.revision) {
      return { kind: "ignored", why: event.revision === existing.revision ? "unchanged" : "stale-revision" };
    }

    const author = directory.lookup(event.ref.workspace, event.author);
    if (author && author.kind !== "member") return { kind: "ignored", why: "not-a-member" };
    const parsed = parser.parse(event.content, { workspace: event.ref.workspace, giver: author?.member });
    const fingerprint = fingerprintOf(parsed);

    if (!existing) {
      if (!parsed) {
        if (event.kind === "edited") remember(event, parsed, fingerprint, "watermark");
        return { kind: "ignored", why: "ordinary-chat" };
      }
      return evaluate(remember(event, parsed, fingerprint, "awaiting-directory"));
    }

    const previousFingerprint = existing.fingerprint;
    Object.assign(existing, { revision: event.revision, parsed, fingerprint });

    if (existing.state === "given") {
      const changed = fingerprint !== previousFingerprint;
      if (changed) feedback.replyPrivately(event.ref, existing.threadRoot, event.author, { kind: "accepted-message-edited" });
      return { kind: "already-given", toldGiver: changed };
    }
    if (fingerprint === previousFingerprint) return { kind: "ignored", why: "unchanged" };
    if (!parsed) return hasOpenAttempt(existing) ? withdraw(existing) : ignoreAsChat(existing);

    Object.assign(existing, { spendsAt: event.at, verifyTries: 0, state: "awaiting-directory" });
    return evaluate(existing);
  }

  function recheck(ref: MessageRef): Observation {
    const record = tables.messages.get(messageKey(ref));
    if (!record || record.state !== "awaiting-directory") return { kind: "ignored", why: "unchanged" };
    return evaluate(record);
  }

  function evaluate(record: MessageRecord): Observation {
    const parsed = record.parsed as KudosMessage;
    const unknown = unknownUsers(record.ref, record.author, parsed);
    if (unknown.length > 0) return retryLater(record, unknown);

    const giver = directory.lookup(record.ref.workspace, record.author) as MemberFacts;
    if (giver.kind !== "member") return ignoreAsChat(record, "not-a-member");
    const { recipients, skipped } = classify(record.ref, parsed, giver.member);
    const outcome = decide(record, giver, recipients, skipped, parsed);

    record.state = outcome.kind;
    sendFeedback(record, outcome);
    return { kind: "evaluated", outcome };
  }

  function decide(record: MessageRecord, giver: Giver, recipients: MemberId[], skipped: SkippedMention[], parsed: KudosMessage): Outcome {
    if (recipients.length === 0) return { kind: "invalid", skipped };

    const day = dayKey(record.spendsAt, giver.timeZone);
    const pools = allowancePools(record.ref, giver.member, day);
    const left = pools.dailyLeft + pools.weeklyLeft;
    const { perRecipient } = parsed;
    const cost = recipients.length * perRecipient;
    if (cost > left) return { kind: "over-allowance", cost, recipients: recipients.length, perRecipient, left };

    const awards = recipients.map((recipient) => ({ giver: giver.member, recipient, kudos: perRecipient }));
    const fromDaily = Math.min(cost, pools.dailyLeft);
    tables.spent.set(pools.dailyKey, pools.dailySpent + fromDaily);
    tables.spentWeekly.set(pools.weeklyKey, pools.weeklySpent + cost - fromDaily);
    tables.awards.push(...awards.map((award) => ({ ...award, message: messageKey(record.ref), day })));
    const kudosEmoji = (parsed.kudosEmoji[0] as KudosEmojiValue).name;
    events.publish({
      type: "kudosGiven",
      workspace: record.ref.workspace,
      message: record.ref,
      giver: giver.member,
      awards,
      kudosEmoji,
      annotations: parsed.annotations,
      allowance: { dailyOpening: pools.dailyOpening, dailyLeft: pools.dailyLeft - fromDaily, weeklyLeft: pools.weeklyLeft - (cost - fromDaily) },
      day,
      at: record.spendsAt,
    });
    return { kind: "given", awards, kudosEmoji, left: left - cost, skipped };
  }

  function sendFeedback(record: MessageRecord, outcome: Outcome) {
    const base = settings.of(record.ref.workspace).baseAllowance;
    feedback.setIndicator(record.ref, { emoji: indicatorEmoji(outcome) });
    const reply =
      outcome.kind === "given"
        ? { kind: outcome.kind, outcome, base }
        : outcome.kind === "over-allowance"
          ? { kind: outcome.kind, outcome, base }
          : { kind: outcome.kind, outcome };
    feedback.replyPrivately(record.ref, record.threadRoot, record.author, reply);
  }

  function withdraw(record: MessageRecord): Observation {
    const hadIndicator = record.state === "over-allowance" || record.state === "invalid";
    record.state = "withdrawn";
    if (hadIndicator) feedback.setIndicator(record.ref, null);
    return { kind: "withdrawn" };
  }

  function ignoreAsChat(record: MessageRecord, why: "ordinary-chat" | "not-a-member" = "ordinary-chat"): Observation {
    record.state = "watermark";
    return { kind: "ignored", why };
  }

  function retryLater(record: MessageRecord, users: ChatUserId[]): Observation {
    const retryInMs = VERIFY_BACKOFF_MS[record.verifyTries];
    if (retryInMs === undefined) {
      record.state = "abandoned";
      return { kind: "abandoned" };
    }
    record.verifyTries += 1;
    return { kind: "awaiting-directory", users, retryInMs };
  }

  function remember(event: MessageEvent, parsed: KudosMessage | null, fingerprint: string, state: MessageState): MessageRecord {
    const record: MessageRecord = {
      ref: event.ref,
      threadRoot: event.threadRoot,
      author: event.author,
      revision: event.revision,
      fingerprint,
      state,
      parsed,
      spendsAt: event.at,
      verifyTries: 0,
    };
    tables.messages.set(messageKey(event.ref), record);
    return record;
  }

  function unknownUsers(ref: MessageRef, author: ChatUserId, parsed: KudosMessage): ChatUserId[] {
    const users = [author, ...personMentions(parsed.mentions)];
    return [...new Set(users)].filter((user) => directory.lookup(ref.workspace, user) === undefined);
  }

  function classify(ref: MessageRef, parsed: KudosMessage, giver: MemberId) {
    const recipients: MemberId[] = [];
    const skipped: SkippedMention[] = [];
    for (const mention of dedupe(parsed.mentions)) {
      if (mention.kind !== "person") {
        skipped.push({ mention, reason: "group-or-broadcast" });
        continue;
      }
      const facts = directory.lookup(ref.workspace, mention.user) as MemberFacts;
      if (facts.kind === "bot") skipped.push({ mention, reason: "bot" });
      else if (facts.kind === "not-a-member") skipped.push({ mention, reason: "not-a-member" });
      else if (facts.member === giver) skipped.push({ mention, reason: "self" });
      else recipients.push(facts.member);
    }
    return { recipients, skipped };
  }

  function allowancePools(ref: MessageRef, giver: MemberId, day: DayKey) {
    const bonus = perks.of(giver, day);
    const dailyOpening = settings.of(ref.workspace).baseAllowance + bonus.dailyBonus;
    const dailyKey = `${giver}|${day}`;
    const weeklyKey = `${giver}|${weekKey(day)}`;
    const dailySpent = tables.spent.get(dailyKey) ?? 0;
    const weeklySpent = tables.spentWeekly.get(weeklyKey) ?? 0;
    return {
      dailyOpening,
      dailyKey,
      weeklyKey,
      dailySpent,
      weeklySpent,
      dailyLeft: Math.max(0, dailyOpening - dailySpent),
      weeklyLeft: Math.max(0, bonus.weeklyBonus - weeklySpent),
    };
  }

  return { observe, recheck };
}

function hasOpenAttempt(record: MessageRecord) {
  return record.state === "over-allowance" || record.state === "invalid" || record.state === "awaiting-directory";
}

function indicatorEmoji(outcome: Outcome) {
  if (outcome.kind === "given") return outcome.kudosEmoji;
  return outcome.kind === "over-allowance" ? "hourglass_flowing_sand" : "x";
}

function fingerprintOf(parsed: KudosMessage | null) {
  if (!parsed) return "";
  const mentions = dedupe(parsed.mentions)
    .map((mention) => (mention.kind === "person" ? `@${mention.user}` : `!${mention.kind}`))
    .sort();
  const emoji = parsed.kudosEmoji.map((value) => value.name).sort();
  return JSON.stringify({ mentions, emoji });
}

function personMentions(mentions: Mention[]): ChatUserId[] {
  return mentions.flatMap((mention) => (mention.kind === "person" ? [mention.user] : []));
}

function dedupe(mentions: Mention[]) {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    const key = mention.kind === "person" ? mention.user : mention.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dayKey(at: number, timeZone: string | undefined): DayKey {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(at) as DayKey;
}

export function weekKey(day: DayKey): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return `week-of-${date.toISOString().slice(0, 10)}`;
}

export function messageKey(ref: MessageRef) {
  return `${ref.workspace}/${ref.conversation}/${ref.message}`;
}
