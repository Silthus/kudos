import type { Face } from "../website/faces";

export type Person = { name: string; face: Face };

export type Segment =
  | { kind: "text"; text: string; bold?: true; italic?: true; strike?: true; code?: true }
  | { kind: "person"; name: string }
  | { kind: "group"; handle: string }
  | { kind: "channel" }
  | { kind: "broadcast"; range: "here" | "channel" | "everyone" }
  | { kind: "emoji"; name: string; unicode?: string }
  | { kind: "link"; url: string; label?: string }
  | { kind: "break" };

export type Message = { kind: "text"; segments: Segment[]; edited: boolean } | { kind: "unavailable"; reason: "deleted" | "removed" | "not-captured" };

export type Channel = { visibility: "public" | "private" };

export type QuestDone = { kind: "weekly"; goal: string; xp: number } | { kind: "journey"; goal: string; xp: number };

export type KudosReceived = {
  kind: "kudosReceived";
  key: string;
  at: number;
  giver: Person;
  channel: Channel;
  saidWhy: boolean | null;
  permalink: string | null;
  message: Message;
};

export type KudosGiven = {
  kind: "kudosGiven";
  key: string;
  at: number;
  recipients: Person[];
  kudos: number;
  channel: Channel;
  saidWhy: boolean | null;
  permalink: string | null;
  message: Message;
  earned: { xp: number | null; questsDone: QuestDone[] } | null;
};

export type LevelUp = { kind: "levelUp"; at: number; level: number };

export type ActivityEntry = KudosReceived | KudosGiven | LevelUp;

export type Activity = { kind: "activity"; entries: ActivityEntry[]; cursor: string | null; timeZone: string | null };

export type RecentKudos = { kind: "recent"; entries: Array<KudosReceived | KudosGiven> };
