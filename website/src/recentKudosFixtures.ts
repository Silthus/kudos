import type { Direction, RecentKudosRead, RecentKudosShown } from "./recentKudosRead";
import type { KudosGiven, KudosReceived, Message, Person, RecentKudos } from "./shell";

const today = Date.parse("2026-10-14T09:30:00");

const yesterday = Date.parse("2026-10-13T16:05:00");

const lastWeek = Date.parse("2026-10-07T11:00:00");

function teammate(name: string, picture?: string): Person {
  const initials = name
    .split(" ")
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return { name, face: picture === undefined ? { kind: "initials", initials } : { kind: "slack", image: picture, initials } };
}

const ada = teammate("Ada Lindqvist", "https://avatars.slack-edge.com/ada_192.png");

const bo = teammate("Bo Okafor");

const cleo = teammate("Cleo Marchetti");

const dev = teammate("Dev Rao");

const eli = teammate("Eli Brandt");

const formerTeammate: Person = { name: "A teammate", face: { kind: "initials", initials: "" } };

const publicChannel = { visibility: "public" } as const;

type Words = Extract<Message, { kind: "text" }>;

function words(...segments: Words["segments"]): Words {
  return { kind: "text", segments, edited: false };
}

function received(key: string, at: number, giver: Person, message: Message): KudosReceived {
  return { kind: "kudosReceived", key, at, giver, channel: publicChannel, saidWhy: true, permalink: null, message };
}

function given(key: string, at: number, recipients: Person[], message: Message): KudosGiven {
  return { kind: "kudosGiven", key, at, recipients, kudos: recipients.length, channel: publicChannel, saidWhy: true, permalink: null, message, earned: { xp: 10, questsDone: [], bonuses: [] } };
}

const threeReceived: RecentKudos = {
  kind: "recent",
  entries: [
    received("r1", today, ada, words({ kind: "text", text: "Thanks for pairing on the release checklist, it saved us a whole afternoon " }, { kind: "emoji", name: "tada", unicode: "🎉" })),
    received("r2", yesterday, bo, { ...words({ kind: "text", text: "The new onboarding doc is " }, { kind: "text", text: "so", bold: true }, { kind: "text", text: " clear. See " }, { kind: "link", url: "https://example.com/onboarding", label: "the doc" }), edited: true }),
    received("r3", lastWeek, formerTeammate, { kind: "unavailable", reason: "not-captured" }),
  ],
};

const threeGiven: RecentKudos = {
  kind: "recent",
  entries: [
    given("g1", today, [cleo], words({ kind: "text", text: "Thank you for jumping on the incident at midnight " }, { kind: "person", name: "Dev Rao" })),
    given("g2", yesterday, [ada, bo], words({ kind: "text", text: "Great demo today, both of you" })),
    given("g3", lastWeek, [ada, bo, cleo, dev, eli], words({ kind: "text", text: "For the whole team offsite " }, { kind: "broadcast", range: "here" })),
  ],
};

const nothingYet: RecentKudos = { kind: "recent", entries: [] };

const unavailableWords: RecentKudos = {
  kind: "recent",
  entries: [received("u1", today, cleo, { kind: "unavailable", reason: "deleted" }), received("u2", lastWeek, dev, { kind: "unavailable", reason: "removed" })],
};

export const recentKudosFixtures = { threeReceived, threeGiven, nothingYet, unavailableWords } as const satisfies Record<string, RecentKudos>;

export function fixedRecentKudos(answers: Record<Direction, RecentKudosShown | undefined>): RecentKudosRead {
  return (direction) => answers[direction];
}

export const fixtureRecentKudos = fixedRecentKudos({ received: threeReceived, given: threeGiven });
