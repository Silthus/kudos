import type { CardEmojisShown, CardWeek, PlayerCard, PlayerCardRead, PlayerCardShown } from "./answer";

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");

const face = (initials: string) => ({ kind: "initials", initials }) as const;

const teamOf = (team: string, name: string, crest: string) => ({ team, name, art: { kind: "crest", slug: crest } }) as const;

const newest = [
  { person: "perrin-holt", name: "Perrin Holt", face: face("PH") },
  { person: "wren-alder", name: "Wren Alder", face: face("WA") },
  { person: "fen-marlowe", name: "Fen Marlowe", face: face("FM") },
];

const samCard: PlayerCard = {
  person: "sam-example",
  name: "Sam Example",
  face: face("SE"),
  team: teamOf("lanterns", "Lanterns", "workflows"),
  level: { level: 6, xp: 1_240, startsAt: 1_000, nextAt: 1_500 },
  place: { rank: 1, tied: false, thoughtful: 7 },
  people: { held: 24, newest },
  hoggies: { found: 64, total: 151, rarest: { hoggie: "burning-money", name: "Burning Money", rarity: "legendary", firstAt: now - 3 * day } },
  medals: { count: 4, best: [{ milestone: "people", tier: "gold" }, { milestone: "teams", tier: "silver" }] },
};

const wrenCard: PlayerCard = {
  person: "wren-alder",
  name: "Wren Alder",
  face: face("WA"),
  team: teamOf("kettle-works", "Kettle Works", "experiments"),
  level: { level: 4, xp: 610, startsAt: 500, nextAt: 800 },
  place: { rank: 3, tied: true, thoughtful: 4 },
  people: { held: 9, newest: [newest[0]!, { person: "sam-example", name: "Sam Example", face: face("SE") }] },
  hoggies: { found: 21, total: 151, rarest: { hoggie: "burning-money", name: "Burning Money", rarity: "epic", firstAt: now - 8 * day } },
  medals: { count: 2, best: [{ milestone: "people", tier: "bronze" }] },
};

const quietCard: PlayerCard = {
  person: "milo-strand",
  name: "Milo Strand",
  face: face("MS"),
  team: null,
  level: { level: 1, xp: 0, startsAt: 0, nextAt: 100 },
  place: null,
  people: { held: 0, newest: [] },
  hoggies: { found: 0, total: 151, rarest: null },
  medals: { count: 0, best: [] },
};

const wrenWeek: CardWeek = {
  days: [1, 3, 0, 2, 0, 0, 0],
  thanked: 4,
  thankedBy: 2,
  packsOpened: 2,
  hugs: 5,
  kudosOfWeek: {
    giver: { person: "perrin-holt", name: "Perrin Holt", face: face("PH") },
    message: { kind: "text", segments: [{ kind: "text", text: "Thank you for staying late to calm the noisy alert before the launch." }], edited: false },
    permalink: "https://example.slack.com/archives/C1/p3",
    at: now - 2 * day,
    hugs: 3,
  },
};

const quietWeek: CardWeek = { days: [0, 0, 0, 0, 0, 0, 0], thanked: 0, thankedBy: 0, packsOpened: 0, hugs: 0, kudosOfWeek: null };

export const playerCardFixtures = {
  sam: { kind: "card", card: samCard },
  wren: { kind: "card", card: wrenCard, week: wrenWeek },
  quiet: { kind: "card", card: quietCard, week: quietWeek },
} satisfies Record<string, PlayerCardShown>;

const emojisOf: Record<string, CardEmojisShown> = {
  "sam-example": { kind: "emojis", count: 7, shown: [{ name: "team-quiet-harbour", picture: "/emoji/team-support.png", inSlack: true }, { name: "ines-okafor-hype", picture: "/emoji/hype.png", inSlack: false }] },
  "wren-alder": { kind: "emojis", count: 3, shown: [{ name: "team-kettle-works", picture: "/emoji/team-experiments.png", inSlack: true }] },
};

const noEmojis: CardEmojisShown = { kind: "emojis", count: 0, shown: [] };

export function fixedPlayerCards(cards: PlayerCardShown[] = Object.values(playerCardFixtures)): PlayerCardRead {
  return (asking, person) => {
    if (!asking || person === null) return { card: undefined, emojis: undefined };
    const card = cards.find((shown) => shown.kind === "card" && shown.card.person === person) ?? { kind: "no-person" };
    return { card, emojis: emojisOf[person] ?? noEmojis };
  };
}
