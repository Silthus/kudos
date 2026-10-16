import type { ActivityRead, ActivityWatch } from "./activityRead";
import type { ActivityFilter } from "./route";
import type { Drop } from "./crates/drops";
import type { Activity, ActivityEntry, Found, HugGiven, HugReceived, KudosGiven, KudosReceived, LevelUp, Message, Person } from "./shell";

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

export function aHugReceived(on: string, at: number, changes: Partial<HugReceived> = {}): HugReceived {
  return { kind: "hugReceived", key: on, at, givers: [teammates.ada], emoji: "hugging_face", hugs: 1, xp: 1, on, permalink: null, kudos: null, ...changes };
}

export function aHugGiven(key: string, at: number, changes: Partial<HugGiven> = {}): HugGiven {
  return { kind: "hugGiven", key, at, people: [teammates.bo], emoji: "hugging_face", xp: 1, on: `C1/${key}`, permalink: null, kudos: null, ...changes };
}

export function aLevelUp(level: number, at: number): LevelUp {
  return { kind: "levelUp", at, level };
}

const blitzscale = { crest: "blitzscale", name: "Blitzscale", art: { kind: "crest", slug: "blitzscale" } } as const;

export const drops = {
  legendaryRocket: { hoggie: "rocket", name: "Rocket", rarity: "legendary", art: { kind: "hoggie", slug: "rocket" }, copy: 1, isNew: true },
  anotherCoffeeCup: { hoggie: "coffee-cup", name: "Coffee Cup", rarity: "common", art: { kind: "hoggie", slug: "coffee-cup" }, copy: 4, isNew: false },
  rocketCompletingBlitzscale: { hoggie: "rocket", name: "Rocket", rarity: "legendary", art: { kind: "hoggie", slug: "rocket" }, copy: 1, isNew: true, crest: blitzscale },
} as const satisfies Record<string, Drop>;

export function aFound(key: string, at: number, drop: Drop): Found {
  return { kind: "found", at, key, drop };
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
    message: words("Thanks for pairing on the release checklist, it saved us a whole afternoon ", { kind: "emoji", name: "tada", unicode: "🎉" }, { kind: "emoji", name: "hedgehug", image: "/favicon.svg" }, { kind: "emoji", name: "raised_hands::skin-tone-4" }),
  }),
  aFound("rocket", fixtureNow - 2 * hour, drops.rocketCompletingBlitzscale),
  aGiven("incident", fixtureNow - 3 * hour, {
    recipients: [teammates.cleo, teammates.dev],
    kudos: 2,
    saidWhy: true,
    permalink: "https://example.slack.com/archives/C1/p2",
    message: words("Thank you both for jumping on the incident at midnight ", { kind: "emoji", name: "fire_engine" }, { kind: "text", text: " The write-up is " }, { kind: "link", url: "https://example.com/incident", label: "here" }, { kind: "text", text: " " }, { kind: "emoji", name: "partyparrot", image: "/no-such-emoji.gif" }),
    earned: {
      xp: 30,
      questsDone: [{ kind: "weekly", goal: "Thank two teammates", xp: 40, waiting: false }],
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
    earned: { xp: 10, questsDone: [{ kind: "journey", goal: "Thank five teammates at once", xp: 50, waiting: false }], bonuses: [] },
  }),
  aReceived("old-kudos", fixtureNow - 75 * hour, { giver: teammates.former, channel: { visibility: "unknown" }, message: { kind: "unavailable", reason: "not-captured" } }),
  aReceived("deleted", fixtureNow - 76 * hour, { giver: teammates.eli, channel: { visibility: "unknown" }, message: { kind: "unavailable", reason: "deleted" } }),
  aLevelUp(5, fixtureNow - 80 * hour),
];

export const activityFixtures = {
  story: aPage(story, null),
  nothingYet: aPage([], null),
} as const satisfies Record<string, Activity>;

const fixturePage = 3;

export const fixtureActivityWatch: ActivityWatch = (filter) => (filter === undefined ? undefined : pageOf(filter, null));

export const fixtureReadActivity: ActivityRead = async ({ filter, cursor }) => pageOf(filter, cursor);

function pageOf(filter: ActivityFilter, cursor: string | null): Activity {
  const entries = onSide(activityFixtures.story, filter);
  const start = cursor === null ? 0 : Number(cursor);
  const next = start + fixturePage;
  return { ...activityFixtures.story, entries: entries.slice(start, next), cursor: next < entries.length ? String(next) : null };
}

function onSide(answer: Activity, filter: ActivityFilter) {
  if (filter === "all") return answer.entries;
  const kind = filter === "received" ? "kudosReceived" : "kudosGiven";
  return answer.entries.filter((entry) => entry.kind === kind);
}
