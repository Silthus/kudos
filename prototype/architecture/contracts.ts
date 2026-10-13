// PROTOTYPE (throwaway, never merged): the contracts at the seams of the kudos backend.
// Nothing in this file names Slack. A chat adapter translates its platform into these types.

type Brand<T, B extends string> = T & { readonly __brand: B };

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type MemberId = Brand<string, "MemberId">;
export type ChatUserId = Brand<string, "ChatUserId">;
export type DayKey = Brand<string, "DayKey">;

export type MessageRef = {
  workspace: WorkspaceId;
  conversation: string;
  message: string;
};

export type Revision = bigint;

export type Mention =
  | { kind: "person"; user: ChatUserId }
  | { kind: "group" }
  | { kind: "broadcast" };

export type MessageContent = {
  mentions: Mention[];
  emoji: string[];
};

export type MessageEvent = {
  kind: "posted" | "edited";
  ref: MessageRef;
  threadRoot?: string;
  author: ChatUserId;
  revision: Revision;
  at: number;
  content: MessageContent;
};

export type SkipReason = "self" | "bot" | "not-a-member" | "group-or-broadcast";
export type SkippedMention = { mention: Mention; reason: SkipReason };

export type Award = { giver: MemberId; recipient: MemberId; kudos: number };

export type Outcome =
  | { kind: "given"; awards: Award[]; kudosEmoji: string; left: number; skipped: SkippedMention[] }
  | { kind: "over-allowance"; cost: number; recipients: number; perRecipient: number; left: number }
  | { kind: "invalid"; skipped: SkippedMention[] };

export type Observation =
  | { kind: "ignored"; why: "not-a-member" | "ordinary-chat" | "stale-revision" | "unchanged" }
  | { kind: "awaiting-directory"; users: ChatUserId[]; retryInMs: number }
  | { kind: "abandoned" }
  | { kind: "withdrawn" }
  | { kind: "already-given"; toldGiver: boolean }
  | { kind: "evaluated"; outcome: Outcome };

export type MemberFacts =
  | { kind: "member"; member: MemberId; timeZone: string | undefined }
  | { kind: "bot" }
  | { kind: "not-a-member" };

export interface Directory {
  lookup(workspace: WorkspaceId, user: ChatUserId): MemberFacts | undefined;
}

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string };

export interface Settings {
  of(workspace: WorkspaceId): WorkspaceSettings;
}

export type GiverPerks = { allowanceBonus: number; kudosEmoji: string[] };

export interface Perks {
  of(giver: MemberId): GiverPerks;
}

export type KudosGiven = {
  workspace: WorkspaceId;
  message: MessageRef;
  giver: MemberId;
  awards: Award[];
  kudosEmoji: string;
  day: DayKey;
  at: number;
};

export interface Announcer {
  kudosGiven(fact: KudosGiven): void;
}

export type Indicator = { emoji: string } | null;

export type Reply =
  | { kind: "given"; outcome: Extract<Outcome, { kind: "given" }>; base: number }
  | { kind: "over-allowance"; outcome: Extract<Outcome, { kind: "over-allowance" }>; base: number }
  | { kind: "invalid"; outcome: Extract<Outcome, { kind: "invalid" }> }
  | { kind: "accepted-message-edited" };

export interface Feedback {
  setIndicator(ref: MessageRef, indicator: Indicator): void;
  replyPrivately(ref: MessageRef, threadRoot: string | undefined, to: ChatUserId, reply: Reply): void;
}

export interface KudosEngine {
  observe(event: MessageEvent): Observation;
  recheck(ref: MessageRef): Observation;
}
