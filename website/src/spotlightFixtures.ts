import type { Person } from "./shell";
import type { SpotlightDraw, SpotlightKudos } from "./spotlightRead";

type Words = SpotlightKudos["message"];

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

function words(...segments: Words["segments"]): Words {
  return { kind: "text", segments, edited: false };
}

function thankYou(after: string, at: string, giver: Person, recipients: Person[], message: Words, permalink: string | null = null): SpotlightKudos {
  return { kind: "kudos", after, at: Date.parse(at), giver, recipients, permalink, message };
}

const pairing = thankYou(
  "draw:pairing",
  "2026-10-12T10:15:00",
  ada,
  [bo],
  words({ kind: "text", text: "Thanks for pairing on the release checklist, it saved us a whole afternoon " }, { kind: "emoji", name: "tada", unicode: "🎉" }),
  "https://example.slack.com/archives/C01/p1760264100000100",
);

const onboarding = thankYou(
  "draw:onboarding",
  "2026-10-09T16:40:00",
  cleo,
  [dev, eli],
  { ...words({ kind: "text", text: "The new onboarding doc is " }, { kind: "text", text: "so", bold: true }, { kind: "text", text: " clear. See " }, { kind: "link", url: "https://example.com/onboarding", label: "the doc" }), edited: true },
);

const offsite = thankYou(
  "draw:offsite",
  "2025-12-03T09:05:00",
  eli,
  [ada, bo, cleo, dev],
  words({ kind: "text", text: "For planning the whole offsite, down to the vegan snacks " }, { kind: "person", name: "Dev Rao" }),
  "https://example.slack.com/archives/C02/p1764752700000200",
);

export const spotlightFixtures = { pairing, onboarding, offsite } as const satisfies Record<string, SpotlightKudos>;

const cycle: SpotlightKudos[] = [pairing, onboarding, offsite];

export const fixtureSpotlight: SpotlightDraw = async (ask) => {
  if ("seed" in ask) return cycle[Math.floor(ask.seed * cycle.length) % cycle.length]!;
  const shown = cycle.findIndex(({ after }) => after === ask.after);
  return cycle[(shown + 1) % cycle.length]!;
};
