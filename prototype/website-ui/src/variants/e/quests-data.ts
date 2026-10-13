// Variant E quest facts: the local pool of weekly quests, the deterministic pick for this week, the group quest, the quest a freshly unlocked feature adds, and the claim and reroll state every quest surface shares.
import { useSyncExternalStore, type ComponentType } from "react";
import {
  HedgehogCoffeeRun,
  HedgehogExplorer,
  HedgehogHandClasp,
  HedgehogLevelUp,
  HedgehogMagnifyingGlass,
  HedgehogMegaphone,
  HedgehogMailbox,
  HedgehogParty,
  HedgehogReading,
  HedgehogSafari,
  HedgehogSailor,
  HedgehogSelfie,
  HedgehogSurfer,
  HedgehogSoapbox,
  HedgehogTourist,
  HedgehogTownCrier,
  HedgehogTwoPlayer,
  HedgehogWizard,
  HedgehogPuzzle,
  HedgehogSuccess,
  HedgehogStar,
} from "@posthog/brand/hoggies";
import { me, members } from "../../data/mock";
import { unlockOf, type Feature } from "./unlocks";

type HogArt = ComponentType<{ size?: number; className?: string; title?: string }>;

type QuestItem = { kind: "emoji"; name: string; emoji: string } | { kind: "hedgehog"; name: string; Art: HogArt };

export type Reward = { xp: number; coins?: number; item?: QuestItem };

type QuestKind = "breadth" | "thoughtful" | "chime-in";

export const kindLabel: Record<QuestKind, string> = { breadth: "Reach out", thoughtful: "Say why", "chime-in": "Chime in" };

type QuestDef = { id: string; goal: string; target: number; kind: QuestKind; Hog: HogArt; reward: Reward };

const pool: QuestDef[] = [
  { id: "new-face", goal: "Thank someone you've never thanked before", target: 1, kind: "breadth", Hog: HedgehogExplorer, reward: { xp: 60, coins: 15 } },
  { id: "two-groups", goal: "Thank people in 2 different groups", target: 2, kind: "breadth", Hog: HedgehogTourist, reward: { xp: 80, coins: 20 } },
  { id: "outside", goal: "Thank someone outside Team Bramble", target: 1, kind: "breadth", Hog: HedgehogSafari, reward: { xp: 50, coins: 10, item: { kind: "emoji", name: "Sunflower", emoji: "🌻" } } },
  { id: "newcomer", goal: "Thank a teammate who joined in the last 3 months", target: 1, kind: "breadth", Hog: HedgehogHandClasp, reward: { xp: 60, coins: 15 } },
  { id: "long-time", goal: "Thank someone you haven't thanked in a month", target: 1, kind: "breadth", Hog: HedgehogMailbox, reward: { xp: 50, coins: 10 } },
  { id: "say-why", goal: "Give 3 thoughtful kudos that say why in 5+ words", target: 3, kind: "thoughtful", Hog: HedgehogReading, reward: { xp: 90, coins: 25 } },
  { id: "three-days", goal: "Give a thoughtful kudos on 3 different days", target: 3, kind: "thoughtful", Hog: HedgehogCoffeeRun, reward: { xp: 90, coins: 20, item: { kind: "hedgehog", name: "Party Hog", Art: HedgehogParty } } },
  { id: "detail", goal: "Name the exact thing someone did in a thoughtful kudos", target: 1, kind: "thoughtful", Hog: HedgehogMagnifyingGlass, reward: { xp: 50, coins: 15 } },
  { id: "chime-two", goal: "Chime in on 2 kudos someone else gave", target: 2, kind: "chime-in", Hog: HedgehogMegaphone, reward: { xp: 60, coins: 10 } },
  { id: "chime-other", goal: "Chime in on a kudos from another group", target: 1, kind: "chime-in", Hog: HedgehogTownCrier, reward: { xp: 50, coins: 10, item: { kind: "emoji", name: "Clapping hands", emoji: "👏" } } },
  { id: "chimed", goal: "Get a chime-in on a kudos you gave", target: 1, kind: "chime-in", Hog: HedgehogSoapbox, reward: { xp: 40, coins: 10 } },
  { id: "pair-up", goal: "Chime in and thank someone on the same day", target: 2, kind: "chime-in", Hog: HedgehogTwoPlayer, reward: { xp: 60, coins: 15 } },
];

type GroupQuestDef = QuestDef & { contributed: string[] };

const bramble = [me.name, ...members.slice(0, me.primaryGroup.members - 1).map((m) => m.name)];

const groupPool: GroupQuestDef[] = [
  { id: "group-everyone", goal: "Everyone in Team Bramble gives one thoughtful kudos", target: bramble.length, kind: "thoughtful", Hog: HedgehogStar, reward: { xp: 120, coins: 30, item: { kind: "hedgehog", name: "Surfer Hog", Art: HedgehogSurfer } }, contributed: [me.name, bramble[1], bramble[2], bramble[4], bramble[5]] },
  { id: "group-reach", goal: "Together, thank people in 4 other groups", target: 4, kind: "breadth", Hog: HedgehogPuzzle, reward: { xp: 120, coins: 30 }, contributed: [bramble[1], bramble[3], bramble[6]] },
  { id: "group-chime", goal: "Everyone in Team Bramble chimes in once", target: bramble.length, kind: "chime-in", Hog: HedgehogSuccess, reward: { xp: 100, coins: 25 }, contributed: [me.name, bramble[2], bramble[3]] },
];

export const groupMembers = bramble;

const featureQuests: (QuestDef & { feature: Feature })[] = [
  { id: "new-leaderboard", feature: "leaderboard", goal: "Thank someone in another group", target: 1, kind: "breadth", Hog: HedgehogSailor, reward: { xp: 50 } },
  { id: "new-book", feature: "book", goal: "Get thanked by 2 people who aren't in your albums yet", target: 2, kind: "breadth", Hog: HedgehogReading, reward: { xp: 70 } },
  { id: "new-skills", feature: "skills", goal: "Spend your first skill point", target: 1, kind: "thoughtful", Hog: HedgehogWizard, reward: { xp: 50 } },
  { id: "new-inventory", feature: "inventory", goal: "Equip a kudos emoji, then thank 3 people with it", target: 3, kind: "breadth", Hog: HedgehogLevelUp, reward: { xp: 80, coins: 20 } },
  { id: "new-collection", feature: "collection", goal: "Pick a hedgehog as your avatar, then give a thoughtful kudos", target: 2, kind: "thoughtful", Hog: HedgehogSelfie, reward: { xp: 60, coins: 15 } },
];

const newFeatureQuestAt = (level: number) => featureQuests.find((q) => [level, level - 1].includes(unlockOf(q.feature).level));

const dayMs = 86_400_000;
const weekStart = (now: Date) => {
  const day = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
};
const today = new Date();
const weekNumber = Math.floor(weekStart(today).getTime() / (7 * dayMs));

const daysUntilReset = Math.max(1, Math.ceil((weekStart(today).getTime() + 7 * dayMs - today.getTime()) / dayMs));

export const resetText = `New quests in ${daysUntilReset} ${daysUntilReset === 1 ? "day" : "days"}`;

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const shuffled = <T>(items: T[], seed: number) => {
  const random = seeded(seed);
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
};

const weekOrder = shuffled(pool, weekNumber);
const weekly = weekOrder.slice(0, 3);
const spare = weekOrder[3];

const groupQuest = groupPool[weekNumber % groupPool.length];

const progressBySlot = [{ claimed: true, done: (def: QuestDef) => def.target }, { claimed: false, done: (def: QuestDef) => def.target }, { claimed: false, done: (def: QuestDef) => def.target - 1 }];

type QuestState = "progress" | "claimable" | "claimed";

export type Quest = { def: QuestDef; done: number; state: QuestState; rerolled: boolean; rerollable: boolean };

const store = { claimed: new Set(weekly.filter((_, i) => progressBySlot[i].claimed).map((q) => q.id)), rerolledSlot: null as number | null, version: 0 };
const listeners = new Set<() => void>();
const emit = () => {
  store.version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const stateOf = (def: QuestDef, done: number): QuestState => (done < def.target ? "progress" : store.claimed.has(def.id) ? "claimed" : "claimable");

const toQuest = (def: QuestDef, done: number, rerollable = false, rerolled = false): Quest => {
  const capped = Math.min(def.target, done);
  return { def, done: capped, state: stateOf(def, capped), rerolled, rerollable };
};

function personalQuests(): Quest[] {
  return weekly.map((def, slot) => {
    if (store.rerolledSlot === slot) return toQuest(spare, 0, false, true);
    const quest = toQuest(def, progressBySlot[slot].done(def));
    return { ...quest, rerollable: store.rerolledSlot === null && quest.state === "progress" };
  });
}

export function claimQuest(id: string) {
  if (store.claimed.has(id)) return;
  store.claimed = new Set(store.claimed).add(id);
  emit();
}

export function rerollQuest(id: string) {
  const slot = weekly.findIndex((q) => q.id === id);
  if (slot < 0 || store.rerolledSlot !== null) return;
  store.rerolledSlot = slot;
  emit();
}

const newFeatureProgress = 1;

export function useQuests(level: number) {
  useSyncExternalStore(subscribe, () => store.version);
  const fresh = newFeatureQuestAt(level);
  return {
    personal: personalQuests(),
    group: { ...toQuest(groupQuest, groupQuest.contributed.length), contributed: groupQuest.contributed },
    fresh: fresh && { ...toQuest(fresh, Math.min(newFeatureProgress, fresh.target - 1)), def: fresh },
    rerollUsed: store.rerolledSlot !== null,
  };
}
