import { ladders, type Ladder } from "../../convex/achievements/ladders";
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

function notStarted({ ladder, name, counts, tiers }: Ladder): LadderCard {
  return { ladder, name, counts, count: 0, tiers: tiers.map(({ tier, name, count }) => ({ tier, name, at: count, earnedAt: null })), next: { tier: "bronze", at: tiers[0]!.count } };
}

const everyShippedLadder = ladders.ladders.map((ladder) => (ladder.ladder === "generosity" ? generosityAtBronze : notStarted(ladder)));

export const bookFixtures = {
  book: { kind: "book", ladders: [generosityAtBronze, recognitionNotYet], timeZone: "Europe/Berlin" },
  everyLadder: { kind: "book", ladders: everyShippedLadder, timeZone: "Europe/Berlin" },
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
