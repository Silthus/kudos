// PROTOTYPE (throwaway, never merged): an in-memory kudos engine behind the KudosEngine interface.
// In Convex, `observe` and `recheck` are internal mutations and the Maps below are tables.

import type {
  Announcer,
  Award,
  ChatUserId,
  DayKey,
  Directory,
  Feedback,
  KudosEngine,
  MemberFacts,
  MemberId,
  MessageContent,
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
  content: MessageContent;
  spendsAt: number;
  verifyTries: number;
};

export type EngineTables = {
  messages: Map<string, MessageRecord>;
  awards: Array<Award & { message: string; day: DayKey }>;
  spent: Map<string, number>;
};

export function emptyTables(): EngineTables {
  return { messages: new Map(), awards: [], spent: new Map() };
}

type Ports = {
  directory: Directory;
  settings: Settings;
  perks: Perks;
  feedback: Feedback;
  announcer: Announcer;
  tables: EngineTables;
};

export function createKudosEngine(ports: Ports): KudosEngine {
  const { directory, settings, perks, feedback, announcer, tables } = ports;

  function observe(event: MessageEvent): Observation {
    const key = messageKey(event.ref);
    const existing = tables.messages.get(key);
    if (existing && event.revision <= existing.revision) {
      return { kind: "ignored", why: event.revision === existing.revision ? "unchanged" : "stale-revision" };
    }

    const author = directory.lookup(event.ref.workspace, event.author);
    if (author === undefined) {
      if (!couldBeKudos(event.content)) return { kind: "ignored", why: "ordinary-chat" };
      return awaitDirectory(event, existing, [event.author]);
    }
    if (author.kind !== "member") return { kind: "ignored", why: "not-a-member" };

    const kudosEmoji = kudosEmojiSet(event.ref.workspace, author.member);
    const fingerprint = fingerprintOf(event.content, kudosEmoji);
    const isKudosMessage = isKudos(event.content, kudosEmoji);

    if (!existing) {
      if (!isKudosMessage) {
        if (event.kind === "edited") remember(event, fingerprint, "watermark");
        return { kind: "ignored", why: "ordinary-chat" };
      }
      return evaluate(remember(event, fingerprint, "awaiting-directory"));
    }

    const previousFingerprint = existing.fingerprint;
    Object.assign(existing, { revision: event.revision, content: event.content, fingerprint });

    if (existing.state === "given") {
      const changed = fingerprint !== previousFingerprint;
      if (changed) feedback.replyPrivately(event.ref, existing.threadRoot, event.author, { kind: "accepted-message-edited" });
      return { kind: "already-given", toldGiver: changed };
    }
    if (fingerprint === previousFingerprint) return { kind: "ignored", why: "unchanged" };
    if (!isKudosMessage) return hasOpenAttempt(existing) ? withdraw(existing) : ignoreAsChat(existing);

    Object.assign(existing, { spendsAt: event.at, verifyTries: 0, state: "awaiting-directory" });
    return evaluate(existing);
  }

  function recheck(ref: MessageRef): Observation {
    const record = tables.messages.get(messageKey(ref));
    if (!record || record.state !== "awaiting-directory") return { kind: "ignored", why: "unchanged" };
    return evaluate(record);
  }

  function evaluate(record: MessageRecord): Observation {
    const workspace = record.ref.workspace;
    const unknown = unknownUsers(record);
    if (unknown.length > 0) return retryLater(record, unknown);

    const giver = directory.lookup(workspace, record.author) as MemberFacts;
    if (giver.kind !== "member") return ignoreAsChat(record, "not-a-member");
    const kudosEmoji = kudosEmojiSet(workspace, giver.member);
    record.fingerprint = fingerprintOf(record.content, kudosEmoji);
    if (!isKudos(record.content, kudosEmoji)) return ignoreAsChat(record);
    const perRecipient = record.content.emoji.filter((name) => kudosEmoji.has(name)).length;
    const { recipients, skipped } = classify(record, giver.member);
    const outcome = decide(record, giver, recipients, skipped, perRecipient, kudosEmoji);

    record.state = outcome.kind;
    announceFeedback(record, outcome);
    return { kind: "evaluated", outcome };
  }

  function decide(
    record: MessageRecord,
    giver: Extract<MemberFacts, { kind: "member" }>,
    recipients: MemberId[],
    skipped: SkippedMention[],
    perRecipient: number,
    kudosEmoji: Set<string>,
  ): Outcome {
    if (recipients.length === 0) return { kind: "invalid", skipped };

    const day = dayKey(record.spendsAt, giver.timeZone);
    const spentKey = `${giver.member}|${day}`;
    const spent = tables.spent.get(spentKey) ?? 0;
    const left = Math.max(0, allowanceOf(record.ref, giver.member) - spent);
    const cost = recipients.length * perRecipient;
    if (cost > left) return { kind: "over-allowance", cost, recipients: recipients.length, perRecipient, left };

    const awards = recipients.map((recipient) => ({ giver: giver.member, recipient, kudos: perRecipient }));
    tables.spent.set(spentKey, spent + cost);
    tables.awards.push(...awards.map((award) => ({ ...award, message: messageKey(record.ref), day })));
    const firstKudosEmoji = record.content.emoji.find((name) => kudosEmoji.has(name)) as string;
    announcer.kudosGiven({
      workspace: record.ref.workspace,
      message: record.ref,
      giver: giver.member,
      awards,
      kudosEmoji: firstKudosEmoji,
      day,
      at: record.spendsAt,
    });
    return { kind: "given", awards, kudosEmoji: firstKudosEmoji, left: left - cost, skipped };
  }

  function announceFeedback(record: MessageRecord, outcome: Outcome) {
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

  function awaitDirectory(event: MessageEvent, existing: MessageRecord | undefined, users: ChatUserId[]): Observation {
    const record = existing ?? remember(event, "", "awaiting-directory");
    Object.assign(record, { revision: event.revision, content: event.content, state: "awaiting-directory", spendsAt: event.at });
    return retryLater(record, users);
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

  function remember(event: MessageEvent, fingerprint: string, state: MessageState): MessageRecord {
    const record: MessageRecord = {
      ref: event.ref,
      threadRoot: event.threadRoot,
      author: event.author,
      revision: event.revision,
      fingerprint,
      state,
      content: event.content,
      spendsAt: event.at,
      verifyTries: 0,
    };
    tables.messages.set(messageKey(event.ref), record);
    return record;
  }

  function unknownUsers(record: MessageRecord): ChatUserId[] {
    const users = [record.author, ...personMentions(record.content)];
    return [...new Set(users)].filter((user) => directory.lookup(record.ref.workspace, user) === undefined);
  }

  function classify(record: MessageRecord, giver: MemberId) {
    const recipients: MemberId[] = [];
    const skipped: SkippedMention[] = [];
    for (const mention of dedupe(record.content.mentions)) {
      if (mention.kind !== "person") {
        skipped.push({ mention, reason: "group-or-broadcast" });
        continue;
      }
      const facts = directory.lookup(record.ref.workspace, mention.user) as MemberFacts;
      if (facts.kind === "bot") skipped.push({ mention, reason: "bot" });
      else if (facts.kind === "not-a-member") skipped.push({ mention, reason: "not-a-member" });
      else if (facts.member === giver) skipped.push({ mention, reason: "self" });
      else recipients.push(facts.member);
    }
    return { recipients, skipped };
  }

  function kudosEmojiSet(workspace: MessageRef["workspace"], giver: MemberId) {
    return new Set([settings.of(workspace).kudosEmoji, ...perks.of(giver).kudosEmoji]);
  }

  function allowanceOf(ref: MessageRef, giver: MemberId) {
    return settings.of(ref.workspace).baseAllowance + perks.of(giver).allowanceBonus;
  }

  return { observe, recheck };
}

function hasOpenAttempt(record: MessageRecord) {
  return record.state === "over-allowance" || record.state === "invalid" || record.state === "awaiting-directory";
}

function couldBeKudos(content: MessageContent) {
  return content.mentions.length > 0 && content.emoji.length > 0;
}

function indicatorEmoji(outcome: Outcome) {
  if (outcome.kind === "given") return outcome.kudosEmoji;
  return outcome.kind === "over-allowance" ? "hourglass_flowing_sand" : "x";
}

function isKudos(content: MessageContent, kudosEmoji: Set<string>) {
  return content.mentions.length > 0 && content.emoji.some((name) => kudosEmoji.has(name));
}

function fingerprintOf(content: MessageContent, kudosEmoji: Set<string>) {
  const mentions = dedupe(content.mentions)
    .map((mention) => (mention.kind === "person" ? `@${mention.user}` : `!${mention.kind}`))
    .sort();
  const emoji = content.emoji.filter((name) => kudosEmoji.has(name)).sort();
  return JSON.stringify({ mentions, emoji });
}

function personMentions(content: MessageContent): ChatUserId[] {
  return content.mentions.flatMap((mention) => (mention.kind === "person" ? [mention.user] : []));
}

function dedupe(mentions: MessageContent["mentions"]) {
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

export function messageKey(ref: MessageRef) {
  return `${ref.workspace}/${ref.conversation}/${ref.message}`;
}
