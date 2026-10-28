import type { Message, Segment } from "../../../convex/activity/entries";
import type { XpMoment } from "../../../convex/website/xpMoment";
import { albumFixtures } from "./albumFixtures";
import type { Album, XpMomentRead } from "./answer";

const minute = 60_000;

const lastVisit = Date.parse("2026-10-19T09:12:00Z");

const said = (...segments: Segment[]): Message => ({ kind: "text", segments, edited: false });

const edited = (...segments: Segment[]): Message => ({ kind: "text", segments, edited: true });

const text = (words: string): Segment => ({ kind: "text", text: words });

const person = (name: string) => ({ name, face: { kind: "initials" as const, initials: name.split(" ").map((word) => word[0]).join("") } });

const kudos: Segment = { kind: "emoji", name: "raised_hands", unicode: "🙌" };

const longThanks = said(
  { kind: "person", name: "Sam Example", person: "sam-example" },
  text(" "),
  kudos,
  text(" thank you for pairing with me on the flaky deploy yesterday. I'd been staring at it for two days, and you found the race in "),
  { kind: "text", text: "retryQueue.ts", code: true },
  text(" in under an hour. You also wrote the runbook so the next person doesn't lose a day to it. "),
  { kind: "text", text: "Absolute legend.", bold: true },
  { kind: "break" },
  text("Notes are in "),
  { kind: "link", url: "https://example.com/runbook", label: "the runbook" },
  text(" for anyone who wants them "),
  { kind: "emoji", name: "tada", unicode: "🎉" },
);

export const xpMomentFixture: XpMoment = {
  kind: "moment",
  since: lastVisit,
  until: lastVisit + 50 * minute,
  excerpts: [
    { entry: { kind: "kudosReceived", key: "k1", at: lastVisit + 10 * minute, giver: person("Ines Okafor"), channel: { visibility: "public" }, saidWhy: true, permalink: null, message: longThanks }, xp: 10 },
    { entry: { kind: "hugReceived", key: "h1", at: lastVisit + 20 * minute, givers: [person("Fen Marlowe")], emoji: "hugging_face", hugs: 3, xp: 3, on: "C1/1.1", permalink: null, kudos: said({ kind: "person", name: "Wren Alder" }, text(" "), kudos, text(" for the clearest onboarding doc I have read here")) }, xp: 3 },
    { entry: { kind: "kudosGiven", key: "k2", at: lastVisit + 30 * minute, recipients: [person("Bram Teller")], kudos: 1, channel: { visibility: "public" }, saidWhy: true, permalink: null, message: edited({ kind: "person", name: "Bram Teller" }, text(" "), kudos, text(" for getting the release notes out on a Friday")), earned: { xp: 15, questsDone: [], bonuses: [] } }, xp: 15 },
    { entry: { kind: "kudosReceived", key: "k3", at: lastVisit + 40 * minute, giver: { name: "Oona Vasquez", face: { kind: "slack", image: "/apple-touch-icon.png", initials: "OV" } }, channel: { visibility: "public" }, saidWhy: true, permalink: null, message: said({ kind: "person", name: "Sam Example", person: "sam-example" }, text(" "), kudos, text(" for the "), { kind: "broadcast", range: "here" }, text(" heads-up")) }, xp: 10 },
    { entry: { kind: "levelUp", at: lastVisit + 50 * minute, level: 7 }, xp: 0 },
  ],
  fold: { count: 12, xp: 140 },
  moments: 16,
  xp: 178,
  climb: { from: { level: 6, xp: 1462, startsAt: 1000, nextAt: 1500 }, to: { level: 7, xp: 1640, startsAt: 1500, nextAt: 2100 } },
  quests: [],
  waiting: 3,
  thoughtfulGivers: 4,
  timeZone: "UTC",
};

export const xpMomentAlbum: Album = { ...albumFixtures.withItems, level: xpMomentFixture.climb.to, lastVisit };

export const fixedXpMoment: XpMomentRead = (asking) => (asking ? xpMomentFixture : undefined);
