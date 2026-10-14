import type { ActivityRead, ActivityWatch } from "./activityRead";
import type { ActivityFilter } from "./route";
import type { Activity, ActivityEntry, KudosGiven, KudosReceived, LevelUp, Message, Person } from "./shell";

type Words = Extract<Message, { kind: "text" }>;

function teammate(name: string, picture?: string): Person {
  const initials = name
    .split(" ")
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return { name, face: picture === undefined ? { kind: "initials", initials } : { kind: "slack", image: picture, initials } };
}

export const teammates = {
  ada: teammate("Ada Lindqvist", "https://avatars.slack-edge.com/ada_192.png"),
  bo: teammate("Bo Okafor"),
  cleo: teammate("Cleo Marchetti"),
  dev: teammate("Dev Rao"),
  eli: teammate("Eli Brandt"),
  former: { name: "A teammate", face: { kind: "initials", initials: "" } } satisfies Person,
};

export function words(text: string, ...more: Words["segments"]): Words {
  return { kind: "text", segments: [{ kind: "text", text }, ...more], edited: false };
}

export function aReceived(key: string, at: number, changes: Partial<KudosReceived> = {}): KudosReceived {
  return { kind: "kudosReceived", key, at, giver: teammates.ada, channel: { visibility: "public" }, saidWhy: false, permalink: null, message: words(`Thank you for ${key}`), ...changes };
}

export function aGiven(key: string, at: number, changes: Partial<KudosGiven> = {}): KudosGiven {
  return { kind: "kudosGiven", key, at, recipients: [teammates.bo], kudos: 1, channel: { visibility: "public" }, saidWhy: false, permalink: null, message: words(`Thanks for ${key}`), earned: { xp: 10, questsDone: [], bonuses: [] }, ...changes };
}

export function aLevelUp(level: number, at: number): LevelUp {
  return { kind: "levelUp", at, level };
}

export function anUnknownKind(): ActivityEntry {
  return { kind: "unlockOpened", at: 1, feature: "quests" } as unknown as ActivityEntry;
}

export function aPage(entries: ActivityEntry[], cursor: string | null, timeZone: string | null = "Europe/Berlin"): Activity {
  return { kind: "activity", entries, cursor, timeZone };
}

const hour = 60 * 60 * 1000;

const fixtureNow = Date.parse("2026-10-14T16:30:00Z");

const story: ActivityEntry[] = [
  aReceived("standup", fixtureNow - hour, {
    giver: teammates.ada,
    saidWhy: true,
    permalink: "https://example.slack.com/archives/C1/p1",
    message: words("Thanks for pairing on the release checklist, it saved us a whole afternoon ", { kind: "emoji", name: "tada", unicode: "🎉" }),
  }),
  aGiven("incident", fixtureNow - 3 * hour, {
    recipients: [teammates.cleo, teammates.dev],
    kudos: 2,
    saidWhy: true,
    permalink: "https://example.slack.com/archives/C1/p2",
    message: words("Thank you both for jumping on the incident at midnight. The write-up is ", { kind: "link", url: "https://example.com/incident", label: "here" }),
    earned: {
      xp: 30,
      questsDone: [{ kind: "weekly", goal: "Thank two teammates", xp: 40 }],
      bonuses: [{ perk: { id: "spark", name: "Spark" }, why: "Your first kudos today", xp: 5 }],
    },
  }),
  aLevelUp(6, fixtureNow - 3 * hour),
  aReceived("onboarding", fixtureNow - 26 * hour, {
    giver: teammates.bo,
    channel: { visibility: "private" },
    permalink: "https://example.slack.com/archives/G1/p3",
    message: { ...words("The new onboarding doc is ", { kind: "text", text: "so", bold: true }, { kind: "text", text: " clear." }), edited: true },
  }),
  aGiven("offsite", fixtureNow - 50 * hour, {
    recipients: [teammates.ada, teammates.bo, teammates.cleo, teammates.dev, teammates.eli],
    message: words("For the whole team offsite ", { kind: "broadcast", range: "here" }),
    earned: { xp: 10, questsDone: [{ kind: "journey", goal: "Thank five teammates at once", xp: 50 }], bonuses: [] },
  }),
  aReceived("old-kudos", fixtureNow - 75 * hour, { giver: teammates.former, message: { kind: "unavailable", reason: "not-captured" } }),
  aReceived("deleted", fixtureNow - 76 * hour, { giver: teammates.eli, message: { kind: "unavailable", reason: "deleted" } }),
  aLevelUp(5, fixtureNow - 80 * hour),
];

export const activityFixtures = {
  story: aPage(story, null),
  nothingYet: aPage([], null),
} as const satisfies Record<string, Activity>;

export const fixtureActivityWatch: ActivityWatch = (filter) => (filter === undefined ? undefined : onSide(activityFixtures.story, filter));

export const fixtureReadActivity: ActivityRead = async ({ filter }) => onSide(activityFixtures.story, filter);

function onSide(answer: Activity, filter: ActivityFilter): Activity {
  if (filter === "all") return answer;
  const kind = filter === "received" ? "kudosReceived" : "kudosGiven";
  return { ...answer, entries: answer.entries.filter((entry) => entry.kind === kind) };
}
