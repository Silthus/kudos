import { ladderOf, ladders, type LadderId } from "../../convex/achievements/ladders";
import type { BookRead } from "./bookRead";
import type { LadderCard, MyBook, ShellState, TierCard } from "./shell";

const at = (iso: string) => Date.parse(iso);

const kudosCounts = [1, 25, 100, 500] as const;

function tiersOf(names: [string, string, string, string], earned: (number | null)[]): TierCard[] {
  const tiers = ["bronze", "silver", "gold", "diamond"] as const;
  return tiers.map((tier, i) => ({ tier, name: names[i]!, at: kudosCounts[i]!, earnedAt: earned[i] ?? null }));
}

const generosityAtBronze: LadderCard = {
  ladder: "generosity",
  name: "Generosity",
  counts: "kudos given",
  count: 3,
  tiers: tiersOf(["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"], [at("2026-10-13T22:30:00Z")]),
  next: { tier: "silver", at: 25 },
};

const recognitionNotYet: LadderCard = {
  ladder: "recognition",
  name: "Recognition",
  counts: "kudos received",
  count: 0,
  tiers: tiersOf(["Noticed", "Appreciated", "Highly Valued", "Hall of Fame"], []),
  next: { tier: "bronze", at: 1 },
};

const generosityComplete: LadderCard = {
  ...generosityAtBronze,
  count: 512,
  tiers: tiersOf(["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"], [at("2026-01-12T09:00:00Z"), at("2026-03-02T09:00:00Z"), at("2026-07-21T09:00:00Z"), at("2026-10-01T09:00:00Z")]),
  next: null,
};

function climbed(id: LadderId, count: number, earnedOn: string[] = []): LadderCard {
  const { ladder, name, counts, tiers } = ladderOf(id);
  const cards = tiers.map(({ tier, name, count: at }, i) => ({ tier, name, at, earnedAt: earnedOn[i] === undefined ? null : Date.parse(earnedOn[i]) }));
  const next = cards.find(({ earnedAt }) => earnedAt === null);
  return { ladder, name, counts, count, tiers: cards, next: next === undefined ? null : { tier: next.tier, at: next.at } };
}

const ladderAtEveryStage = {
  generosity: generosityAtBronze,
  recognition: recognitionNotYet,
  connections: climbed("connections", 31, ["2026-02-03T09:00:00Z", "2026-03-10T09:00:00Z", "2026-05-19T09:00:00Z", "2026-09-08T09:00:00Z"]),
  dependability: climbed("dependability", 240, ["2026-01-20T09:00:00Z", "2026-03-04T09:00:00Z", "2026-07-21T22:30:00Z"]),
  applause: climbed("applause", 7, ["2026-06-11T09:00:00Z"]),
  seasons: climbed("seasons", 8, ["2026-01-30T09:00:00Z", "2026-03-31T09:00:00Z", "2026-06-30T09:00:00Z"]),
  "old-friends": climbed("old-friends", 4, ["2026-04-02T09:00:00Z", "2026-08-14T09:00:00Z"]),
} satisfies Record<LadderId, LadderCard>;

const everyShippedLadder = ladders.ladders.map(({ ladder }) => ladderAtEveryStage[ladder]);

const everyStage = (["generosity", "recognition", "connections", "dependability"] as const).map((ladder) => ladderAtEveryStage[ladder]);

export const bookFixtures = {
  book: { kind: "book", ladders: [generosityAtBronze, recognitionNotYet], timeZone: "Europe/Berlin" },
  everyLadder: { kind: "book", ladders: everyShippedLadder, timeZone: "Europe/Berlin" },
  everyStage: { kind: "book", ladders: everyStage, timeZone: "Europe/Berlin" },
  everyTierEarned: { kind: "book", ladders: [generosityComplete, recognitionNotYet], timeZone: "Europe/Berlin" },
  locked: { kind: "locked", level: 4 },
  ready: { kind: "ready" },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MyBook>;

export function fixedBook(answer: MyBook): BookRead {
  return (asking) => (asking ? answer : undefined);
}

export function fixtureBookFor(visitor: ShellState): BookRead {
  return fixedBook(bookAnswerFor(visitor));
}

function bookAnswerFor(visitor: ShellState): MyBook {
  const card = visitor.kind === "member" ? visitor.features?.find(({ feature }) => feature === "book") : undefined;
  if (card === undefined) return bookFixtures.notFound;
  if (card.state === "locked") return { kind: "locked", level: card.level };
  if (card.state === "ready") return bookFixtures.ready;
  return bookFixtures.everyLadder;
}
