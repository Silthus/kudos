// PROTOTYPE (#625): throwaway in-memory game world for the five website variants. Never merge to main.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { levelOf, xpToReach } from "../../../convex/progression/levels";
import { bookFixtures } from "../bookFixtures";
import { collectionFixtures } from "../collectionFixtures";
import type { CollectionHoggie, CollectionTeamPage, Sticker } from "../collectionRead";
import { leaderboardFixtures } from "../leaderboardFixtures";
import { recentKudosFixtures } from "../recentKudosFixtures";
import type { Face, KudosGiven, KudosReceived, LadderCard, LeaderboardRow, Rarity } from "../shell";
import { teamPages, teamStickers } from "../teamPagesFixtures";

export type QuestSource = "journey" | "weekly" | "group";

export type QuestState = "active" | "finished" | "claimed";

export type Quest = {
  id: string;
  source: QuestSource;
  title: string;
  goal: string;
  hint: string | null;
  progress: { done: number; target: number };
  reward: { xp: number; coins: number };
  state: QuestState;
  opens: string | null;
};

export type PackKind = "journey" | "weekly" | "group" | "bought";

export type Pack = { id: string; kind: PackKind; from: string };

export type Drop = { hoggie: string; name: string; rarity: Rarity; isNew: boolean; copy: number; xp: number; coins: number; levelBefore: number; levelAfter: number };

export type Me = { name: string; face: Face; kudosEmoji: string; allowance: { left: number; base: number }; thisWeek: { given: number; received: number }; lifetime: { given: number; received: number } };

export type Level = { level: number; xp: number; startsAt: number; nextAt: number; toNext: number; progress: number };

export type World = {
  me: Me;
  level: Level;
  coins: number;
  quests: Quest[];
  packs: Pack[];
  store: { price: number };
  hoggies: CollectionHoggie[];
  owned: number;
  total: number;
  rarities: { rarity: Rarity; owned: number; total: number }[];
  teams: CollectionTeamPage[];
  stickers: Sticker[];
  achievements: LadderCard[];
  board: LeaderboardRow[];
  received: KudosReceived[];
  given: KudosGiven[];
  lastDrop: Drop | null;
};

export type WorldActions = {
  progressQuest(id: string): void;
  finishQuest(id: string): void;
  openPack(id: string): Drop | null;
  buyPack(): boolean;
  forgetLastDrop(): void;
  reset(): void;
};

const rarityOrder: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

const journeySteps: Omit<Quest, "state" | "progress">[] = [
  { id: "journey:someone-new", source: "journey", title: "Journey", goal: "Thank someone you haven't thanked before.", hint: null, reward: { xp: 30, coins: 0 }, opens: "the Leaderboard" },
  { id: "journey:your-emoji", source: "journey", title: "Journey", goal: "Give a kudos that says why with one of your kudos emoji.", hint: "Your kudos emoji live in the store.", reward: { xp: 40, coins: 20 }, opens: "your own kudos emoji" },
  { id: "journey:old-friend", source: "journey", title: "Journey", goal: "Thank someone you last thanked a month ago.", hint: null, reward: { xp: 50, coins: 10 }, opens: null },
];

function journeyQuestAt(index: number): Quest | null {
  const step = journeySteps[index];
  return step === undefined ? null : { ...step, state: "active", progress: { done: 0, target: 1 } };
}

const startingQuests: Quest[] = [
  { ...journeyQuestAt(0)!, progress: { done: 0, target: 1 } },
  { id: "weekly:0", source: "weekly", title: "Say why", goal: "Thank someone and say why, 3 times.", hint: "It counts when your message has 5 or more words besides mentions and emoji.", progress: { done: 1, target: 3 }, reward: { xp: 20, coins: 10 }, state: "active", opens: null },
  { id: "weekly:1", source: "weekly", title: "Reach out", goal: "Thank someone you haven't thanked before.", hint: null, progress: { done: 1, target: 1 }, reward: { xp: 20, coins: 10 }, state: "finished", opens: null },
  { id: "weekly:2", source: "weekly", title: "Join in", goal: "Give 5 hugs to teammates' messages.", hint: null, progress: { done: 4, target: 5 }, reward: { xp: 20, coins: 10 }, state: "active", opens: null },
  { id: "group:ants", source: "group", title: "Team quest", goal: "Your team thanks someone and says why, 3 times.", hint: null, progress: { done: 1, target: 3 }, reward: { xp: 0, coins: 15 }, state: "active", opens: null },
];

const startingPacks: Pack[] = [
  { id: "pack:weekly:1", kind: "weekly", from: "Reach out" },
  { id: "pack:journey:first-quest", kind: "journey", from: "Finish a weekly quest" },
  { id: "pack:bought:1", kind: "bought", from: "The store" },
];

const startingXp = 1460;

const startingCoins = 236;

const dropOrder = ["wizard", "doctor", "banana", "oprah", "surfer", "coffee-cup", "robot", "chef", "rocket", "heart"];

const me: Me = {
  name: "Sam Example",
  face: { kind: "initials", initials: "SE" },
  kudosEmoji: "taco",
  allowance: { left: 2, base: 3 },
  thisWeek: { given: 6, received: 4 },
  lifetime: { given: 48, received: 37 },
};

const board = leaderboardFixtures.midBoard.rows;

const received = recentKudosFixtures.threeReceived.entries.filter((entry): entry is KudosReceived => entry.kind === "kudosReceived");

const given = recentKudosFixtures.threeGiven.entries.filter((entry): entry is KudosGiven => entry.kind === "kudosGiven");

const achievements = bookFixtures.everyLadder.ladders;

export function levelAt(xp: number): Level {
  const level = levelOf(xp);
  const startsAt = xpToReach(level);
  const nextAt = xpToReach(level + 1);
  return { level, xp, startsAt, nextAt, toNext: nextAt - xp, progress: (xp - startsAt) / (nextAt - startsAt) };
}

type Inner = { xp: number; coins: number; quests: Quest[]; packs: Pack[]; hoggies: CollectionHoggie[]; journeyAt: number; drops: number; bought: number; lastDrop: Drop | null };

function initial(): Inner {
  return { xp: startingXp, coins: startingCoins, quests: startingQuests, packs: startingPacks, hoggies: collectionFixtures.collection.hoggies, journeyAt: 0, drops: 0, bought: 1, lastDrop: null };
}

function worldOf(inner: Inner): World {
  const owned = inner.hoggies.filter(({ count }) => count > 0).length;
  return {
    me,
    level: levelAt(inner.xp),
    coins: inner.coins,
    quests: inner.quests,
    packs: inner.packs,
    store: { price: 50 },
    hoggies: inner.hoggies,
    owned,
    total: inner.hoggies.length,
    rarities: rarityOrder.map((rarity) => ({ rarity, owned: inner.hoggies.filter((hoggie) => hoggie.rarity === rarity && hoggie.count > 0).length, total: inner.hoggies.filter((hoggie) => hoggie.rarity === rarity).length })),
    teams: teamPages.filter(({ listed }) => listed),
    stickers: teamStickers,
    achievements,
    board,
    received,
    given,
    lastDrop: inner.lastDrop,
  };
}

function packKindOf(source: QuestSource): PackKind {
  return source;
}

function finished(inner: Inner, quest: Quest): Inner {
  const done: Quest = { ...quest, state: "finished", progress: { ...quest.progress, done: quest.progress.target } };
  return { ...inner, quests: inner.quests.map((entry) => (entry.id === quest.id ? done : entry)), packs: [...inner.packs, { id: `pack:${quest.id}`, kind: packKindOf(quest.source), from: quest.goal }] };
}

function claimedFrom(inner: Inner, pack: Pack): Inner {
  const questId = pack.id.replace(/^pack:/, "");
  const quest = inner.quests.find(({ id }) => id === questId);
  if (quest === undefined) return inner;
  const claimed = inner.quests.map((entry) => (entry.id === questId ? { ...entry, state: "claimed" as const } : entry));
  if (quest.source !== "journey") return { ...inner, quests: claimed };
  const next = journeyQuestAt(inner.journeyAt + 1);
  return { ...inner, journeyAt: inner.journeyAt + 1, quests: next === null ? claimed : [next, ...claimed.filter(({ id }) => id !== questId), { ...quest, state: "claimed" }] };
}

function rewardOf(pack: Pack, inner: Inner) {
  const quest = inner.quests.find(({ id }) => `pack:${id}` === pack.id);
  if (quest !== undefined) return quest.reward;
  return { xp: 40 + (inner.drops % 4) * 15, coins: 5 + (inner.drops % 3) * 10 };
}

const WorldContext = createContext<{ world: World; actions: WorldActions } | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const [inner, setInner] = useState(initial);
  const [pending, setPending] = useState<Drop | null>(null);

  const progressQuest = useCallback((id: string) => {
    setInner((current) => {
      const quest = current.quests.find((entry) => entry.id === id);
      if (quest === undefined || quest.state !== "active") return current;
      if (quest.progress.done + 1 >= quest.progress.target) return finished(current, quest);
      return { ...current, quests: current.quests.map((entry) => (entry.id === id ? { ...entry, progress: { ...entry.progress, done: entry.progress.done + 1 } } : entry)) };
    });
  }, []);

  const finishQuest = useCallback((id: string) => {
    setInner((current) => {
      const quest = current.quests.find((entry) => entry.id === id);
      return quest === undefined || quest.state !== "active" ? current : finished(current, quest);
    });
  }, []);

  const openPack = useCallback(
    (id: string): Drop | null => {
      const pack = inner.packs.find((entry) => entry.id === id);
      if (pack === undefined) return null;
      const slug = dropOrder[inner.drops % dropOrder.length]!;
      const hoggie = inner.hoggies.find((entry) => entry.hoggie === slug) ?? inner.hoggies[inner.drops % inner.hoggies.length]!;
      const reward = rewardOf(pack, inner);
      const drop: Drop = { hoggie: hoggie.hoggie, name: hoggie.name, rarity: hoggie.rarity, isNew: hoggie.count === 0, copy: hoggie.count + 1, xp: reward.xp, coins: reward.coins, levelBefore: levelOf(inner.xp), levelAfter: levelOf(inner.xp + reward.xp) };
      const hoggies = inner.hoggies.map((entry) => (entry.hoggie === hoggie.hoggie ? { ...entry, count: entry.count + 1, firstAt: entry.firstAt ?? Date.now() } : entry));
      const opened = { ...inner, xp: inner.xp + reward.xp, coins: inner.coins + reward.coins, hoggies, drops: inner.drops + 1, packs: inner.packs.filter((entry) => entry.id !== id), lastDrop: drop };
      setInner(claimedFrom(opened, pack));
      setPending(drop);
      return drop;
    },
    [inner],
  );

  const buyPack = useCallback(() => {
    if (inner.coins < 50) return false;
    setInner({ ...inner, coins: inner.coins - 50, bought: inner.bought + 1, packs: [...inner.packs, { id: `pack:bought:${inner.bought + 1}`, kind: "bought", from: "The store" }] });
    return true;
  }, [inner]);

  const forgetLastDrop = useCallback(() => setPending(null), []);

  const reset = useCallback(() => {
    setInner(initial());
    setPending(null);
  }, []);

  const value = useMemo(() => ({ world: { ...worldOf(inner), lastDrop: pending }, actions: { progressQuest, finishQuest, openPack, buyPack, forgetLastDrop, reset } }), [inner, pending, progressQuest, finishQuest, openPack, buyPack, forgetLastDrop, reset]);
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export function useWorld() {
  const value = useContext(WorldContext);
  if (value === null) throw new Error("useWorld needs a WorldProvider.");
  return value;
}

export const rarityColour: Record<Rarity, string> = {
  common: "var(--rarity-common)",
  uncommon: "var(--rarity-uncommon)",
  rare: "var(--rarity-rare)",
  epic: "var(--rarity-epic)",
  legendary: "var(--rarity-legendary)",
};

export { rarityOrder };
