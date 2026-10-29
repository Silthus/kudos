import type { Message } from "../shell";
import type { AlbumWeek, HoggiesFound, PeopleListed, WeekIssue, WeekKudos, WeekKudosList, WeekPerson, WeekRead, WeekShown, WeekTab } from "./answer";

const thisWeek = "2026-10-12";

function person(slug: string): WeekPerson {
  const words = slug.split("-");
  const name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const initials = words.map((word) => word.charAt(0).toUpperCase()).join("");
  if (slug === "perrin-holt") return { person: slug, name, face: { kind: "slack", image: "https://avatars.slack-edge.com/2026-10-01/perrin_72.png", initials } };
  return { person: slug, name, face: { kind: "initials", initials } };
}

function listed(slugs: string[], more = 0): PeopleListed {
  return { people: slugs.map(person), more };
}

function words(text: string): Message {
  return { kind: "text", segments: [{ kind: "text", text }], edited: false };
}

function kudos(slugs: string[], text: string, at: string, morePeople = 0): WeekKudos {
  return { people: slugs.map(person), morePeople, message: words(text), at: Date.parse(at) };
}

const nobody: PeopleListed = { people: [], more: 0 };

const noKudos: WeekKudosList = { kudos: [], more: false };

const noHoggies: HoggiesFound = { hoggies: [], more: 0 };

const quietIssue: WeekIssue = {
  kudosGiven: 0,
  kudosReceived: 0,
  thoughtfulGiven: 0,
  thoughtfulReceived: 0,
  hugsGiven: 0,
  hugsReceived: 0,
  packsOpened: 0,
  days: [0, 0, 0, 0, 0, 0, 0],
  kudosOfWeek: null,
  thanked: nobody,
  thankedBy: nobody,
  hugged: nobody,
  huggedBy: nobody,
  newFaces: nobody,
  hoggies: noHoggies,
  given: noKudos,
  received: noKudos,
};

const fullIssue: WeekIssue = {
  kudosGiven: 6,
  kudosReceived: 4,
  thoughtfulGiven: 4,
  thoughtfulReceived: 2,
  hugsGiven: 3,
  hugsReceived: 5,
  packsOpened: 3,
  days: [2, 4, 1, 0, 6, 3, 2],
  kudosOfWeek: { giver: person("ines-okafor"), message: words("You untangled the release notes at midnight and saved the launch."), permalink: "https://hedgehug.slack.com/archives/C0ABCDEF1/p1760600000000100", at: Date.parse("2026-10-16T09:30:00Z"), hugs: 3 },
  thanked: listed(["ines-okafor", "wren-alder", "perrin-holt", "juno-park"]),
  thankedBy: listed(["ines-okafor", "fen-marlowe", "oren-pike"]),
  hugged: listed(["wren-alder", "della-crane"]),
  huggedBy: listed(["ines-okafor", "juno-park", "kit-sorrel"]),
  newFaces: listed(["juno-park", "kit-sorrel"]),
  hoggies: {
    hoggies: [
      { hoggie: "dr-manhattan", rarity: "legendary" },
      { hoggie: "basketball-coach", rarity: "uncommon" },
      { hoggie: "banana", rarity: "common" },
    ],
    more: 0,
  },
  given: {
    kudos: [
      kudos(["perrin-holt", "wren-alder"], "Thanks for pairing on the flaky deploy until it went green.", "2026-10-17T16:00:00Z"),
      kudos(["juno-park"], "Your onboarding doc answered every question I had.", "2026-10-13T10:15:00Z"),
    ],
    more: false,
  },
  received: {
    kudos: [kudos(["fen-marlowe"], "The demo today was brilliant, the way you explained the data model clicked for everyone.", "2026-10-15T14:00:00Z"), kudos(["oren-pike"], "ty for the quick review", "2026-10-12T09:00:00Z")],
    more: false,
  },
};

const crowd = ["ada-quill", "bram-teller", "cass-vey", "della-crane", "eli-brask", "fen-marlowe", "gus-marrow", "hale-wren", "ivo-lark", "juno-park", "kit-sorrel", "lys-amber"];

const overflowingIssue: WeekIssue = {
  ...fullIssue,
  kudosGiven: 23,
  thoughtfulGiven: 21,
  kudosReceived: 14,
  thoughtfulReceived: 9,
  packsOpened: 15,
  days: [5, 6, 2, 3, 4, 1, 2],
  thanked: listed(crowd, 9),
  thankedBy: listed(crowd.slice(0, 7)),
  newFaces: listed(crowd, 3),
  hoggies: { hoggies: crowd.map((_, index) => ({ hoggie: ["banana", "coffee-run", "asleep", "ball"][index % 4]!, rarity: "common" as const })), more: 3 },
  given: { kudos: [kudos(crowd.slice(0, 3), "Thanks for carrying the migration weekend.", "2026-10-02T11:00:00Z", 6)], more: true },
  received: { kudos: [kudos(["cass-vey"], "Thanks for the late-night fix.", "2026-09-30T20:00:00Z")], more: false },
};

const ownKudosIssue: WeekIssue = {
  ...quietIssue,
  kudosGiven: 1,
  thoughtfulGiven: 1,
  days: [0, 0, 1, 0, 0, 0, 0],
  kudosOfWeek: { giver: person("sam-example"), message: { kind: "unavailable", reason: "not-captured" }, permalink: null, at: Date.parse("2026-09-23T15:00:00Z"), hugs: 0 },
  thanked: listed(["oren-pike", "ada-quill"]),
  given: { kudos: [kudos(["ada-quill"], "Thanks for the warm welcome on my first day.", "2026-09-22T08:30:00Z")], more: false },
};

const tabs: WeekTab[] = [
  { week: thisWeek, days: fullIssue.days, counted: 18 },
  { week: "2026-10-05", days: quietIssue.days, counted: 0 },
  { week: "2026-09-28", days: overflowingIssue.days, counted: 23 },
  { week: "2026-09-21", days: ownKudosIssue.days, counted: 1 },
];

const issues: Record<string, WeekIssue> = { [thisWeek]: fullIssue, "2026-10-05": quietIssue, "2026-09-28": overflowingIssue, "2026-09-21": ownKudosIssue };

function editionOf(week: string): AlbumWeek {
  return { kind: "week", week, thisWeek, weeks: tabs, issue: issues[week] ?? null };
}

export const weekFixtures = {
  full: editionOf(thisWeek),
  quiet: editionOf("2026-10-05"),
  overflowing: editionOf("2026-09-28"),
  ownKudos: editionOf("2026-09-21"),
  noHistory: { kind: "week", week: thisWeek, thisWeek, weeks: [], issue: null },
} satisfies Record<string, AlbumWeek>;

export function fixtureWeeks(): WeekRead {
  return (asking, week) => (asking ? editionOf(week ?? thisWeek) : undefined);
}

export function fixedWeek(answer: WeekShown): WeekRead {
  return (asking) => (asking ? answer : undefined);
}
