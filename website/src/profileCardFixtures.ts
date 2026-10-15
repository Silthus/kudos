import type { ProfileCardRead } from "./profileCardRead";
import type { Medal, MyProfileCard, ShellState } from "./shell";

const patronOfPraise: Medal = { ladder: "generosity", tier: "diamond", name: "Patron of Praise" };
const highlyValued: Medal = { ladder: "recognition", tier: "gold", name: "Highly Valued" };
const connector: Medal = { ladder: "connections", tier: "silver", name: "Connector" };
const regular: Medal = { ladder: "dependability", tier: "bronze", name: "Regular" };

const card = { kind: "card", name: "Sam Example", level: 7, group: null } as const;

export const profileCardFixtures = {
  bestFour: { ...card, medals: [patronOfPraise, highlyValued, connector, regular] },
  twoMedals: { ...card, medals: [highlyValued, regular] },
  noMedals: { ...card, medals: [] },
  inAGroup: { ...card, group: "Team Ants", medals: [highlyValued, regular] },
  notFound: { kind: "not-found" },
} as const satisfies Record<string, MyProfileCard>;

export function fixedProfileCard(answer: MyProfileCard): ProfileCardRead {
  return (asking) => (asking ? answer : undefined);
}

export function fixtureProfileCardFor(visitor: ShellState): ProfileCardRead {
  const book = visitor.kind === "member" ? visitor.features?.find(({ feature }) => feature === "book") : undefined;
  return fixedProfileCard(book?.state === "open" ? profileCardFixtures.bestFour : profileCardFixtures.noMedals);
}
