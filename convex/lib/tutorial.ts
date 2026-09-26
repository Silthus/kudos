/**
 * The tutorial (#159, design plan #152 S4): the elder hog's chain of ten first steps for every new
 * member, in a fixed order, each with one action and one sentence on why, each opening the next
 * thing to use. Pure rules, shared by the server (convex/tutorial.ts: which step is next, how each
 * is detected, the 5 Hog coins each pays once) and the world (the elder hog's window, the HUD's
 * checklist and what the HUD and the map show).
 *
 * Gating is presentation only: `hudShows` and `placeHint` say what the HUD shows and which places
 * draw dim with a hint. Every route and every mutation works whatever step a member is on.
 */

export type TutorialStepId = "arrive" | "thanks" | "feed" | "look" | "grow" | "learn" | "trade" | "explore" | "settle" | "together";

export type TutorialStep = {
  id: TutorialStepId;
  /** 1 to 10, the step's place in the chain. */
  n: number;
  /** Its name in the checklist: "Feed the tree". */
  title: string;
  /** The one thing to do, as the elder hog says it. */
  action: string;
  /** The one sentence on why. */
  why: string;
  /** Where it's done, when that's a place: its window's route. */
  to?: string;
  /** It waits for this level (shown "at level N" with the XP bar); done at any level all the same. */
  level?: number;
  /** It waits for the homes ring to open (the tree's grown stage). */
  homes?: true;
  /** Done in the world, not by anything the server records: the client says so (`api.tutorial.advance`). */
  client?: true;
};

/** Hog coins each step pays, once, as a `tutorial` game event. */
export const TUTORIAL_COINS = 5;

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: "arrive", n: 1, title: "Arrive", action: "Walk to the elder hog", why: "The elder hog knows every path round the tree.", client: true, to: "/elder" },
  { id: "thanks", n: 2, title: "Say thanks", action: "Give your first thoughtful kudos", why: "A few words on why is what makes the tree grow." },
  { id: "feed", n: 3, title: "Feed the tree", action: "Offer your appreciation at the offering stone", why: "Your kudos wait at the tree as Hog coins until you offer them.", to: "/offering" },
  { id: "look", n: 4, title: "Look around", action: "Open Places in the top corner", why: "Every place round the tree is one click away from there.", client: true },
  { id: "grow", n: 5, title: "Grow something", action: "Plant for a teammate on your terrace", why: "A plant grows each week you thank the teammate it's for.", to: "/garden", level: 3 },
  { id: "learn", n: 6, title: "Learn", action: "Take a skill on the elder oak", why: "Every level brings a skill point to spend on how you play.", to: "/skills", level: 4 },
  { id: "trade", n: 7, title: "Trade", action: "Sell a fruit or buy an item at the stall", why: "Hog coins buy boosters, looks and more at the stall.", to: "/store", level: 5 },
  { id: "explore", n: 8, title: "Explore", action: "Go on your first expedition into the ruins", why: "The ruins hold coins, gear and secrets, and kudos restore your stamina.", level: 6 },
  { id: "settle", n: 9, title: "Settle", action: "Buy a branch plot for your home", why: "A home on the tree is yours to build, stage by stage.", homes: true },
  { id: "together", n: 10, title: "Together", action: "Join a crew quest or a party expedition", why: "Some things on the tree only the whole crew can build." },
];

export const TUTORIAL_STEP_BY_ID = Object.fromEntries(TUTORIAL_STEPS.map((s) => [s.id, s])) as Record<TutorialStepId, TutorialStep>;

/** The step after `completed` steps done: the first not done, or null once the chain is done. */
export function tutorialStep(completed: number): TutorialStep | null {
  return TUTORIAL_STEPS[completed] ?? null;
}

/** What a step still waits for before its action can be done, if anything. */
export type StepGate = { kind: "level"; level: number; label: string } | { kind: "district"; label: string };

export function stepGate(step: TutorialStep, at: { level: number; homesOpen: boolean }): StepGate | null {
  if (step.level !== undefined && at.level < step.level) return { kind: "level", level: step.level, label: `at level ${step.level}` };
  if (step.homes && !at.homesOpen) return { kind: "district", label: "when the homes ring opens" };
  return null;
}

/**
 * What the HUD shows on step `current` (1 to 11; 11 once done): the wallet from step 3, where
 * you feed the tree, and stamina from step 8, the first expedition. Null (no chain: the game is off
 * or hidden) shows everything, as before the tutorial.
 */
export function hudShows(current: number | null): { wallet: boolean; stamina: boolean } {
  if (current === null) return { wallet: true, stamina: true };
  return { wallet: current >= TUTORIAL_STEP_BY_ID.feed.n, stamina: current >= TUTORIAL_STEP_BY_ID.explore.n };
}

/**
 * The places the chain opens: each with the step that uses it (it stands dim until that step is
 * next) and what opens it, the step before.
 */
const PLACE_OPENS: Record<string, { step: TutorialStepId; after: string }> = {
  offering: { step: "feed", after: "your first thoughtful kudos" },
  quests: { step: "look", after: "you feed the tree" },
  me: { step: "grow", after: "you look around" },
  garden: { step: "grow", after: "you look around" },
  skills: { step: "learn", after: "you grow something" },
  store: { step: "trade", after: "you learn a skill" },
};

/**
 * The hint a place draws dim with on step `current` ("Opens after you feed the tree"), or null
 * where it's open: a place the chain doesn't open, a step already reached, or no chain.
 */
export function placeHint(placeId: string, current: number | null): string | null {
  const opens = PLACE_OPENS[placeId];
  if (current === null || !opens || current >= TUTORIAL_STEP_BY_ID[opens.step].n) return null;
  return `Opens after ${opens.after}`;
}
