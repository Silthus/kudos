import { v, type Infer } from "convex/values";
import { weeklyQuestValidator, type Quest, type WeeklyQuest } from "../quests/step";
import type { WeekKey } from "../quests/week";
import { featureValidator, type Feature } from "../unlocks/feature";
import type { pageValidator } from "./link";

export type Page = Infer<typeof pageValidator>;

const namedCrateValidator = v.union(...featureValidator.members, v.literal("journey"));

type NamedCrate = Infer<typeof namedCrateValidator>;

export const crateTargetValidator = v.union(...namedCrateValidator.members, weeklyQuestValidator);

export type CrateTarget = Infer<typeof crateTargetValidator>;

const namedCrates: readonly NamedCrate[] = namedCrateValidator.members.map(({ value }) => value);

const weeklyCrateParam = /^weekly:(\d{4}-\d{2}-\d{2}):(\d+)$/;

export function crateParamOf(crate: CrateTarget): string {
  return typeof crate === "string" ? crate : `${crate.kind}:${crate.week}:${crate.slot}`;
}

export function crateTargetIn(param: string | null): CrateTarget | undefined {
  const named = namedCrates.find((crate) => crate === param);
  if (named !== undefined) return named;
  const weekly = param === null ? null : weeklyCrateParam.exec(param);
  return weekly === null ? undefined : { kind: "weekly", week: weekly[1]!, slot: Number(weekly[2]) };
}

export const routeList: readonly string[] = ["/", "/leaderboard", "/quests", "/skills", "/book", "/book/earned", "/activity", "/settings"];

export const signInEntry = "/sign-in";

const pathOf: Record<Page["page"], string> = {
  home: "/",
  leaderboard: "/leaderboard",
  quests: "/quests",
  skillTree: "/skills",
  book: "/book",
  bookEarned: "/book/earned",
};

const featurePages: Partial<Record<Feature, Page>> = {
  quests: { page: "quests" },
  leaderboard: { page: "leaderboard", period: "week" },
  book: { page: "book" },
  skillTree: { page: "skillTree" },
};

export function listed(page: Page): boolean {
  return routeList.includes(pathOf[page.page]);
}

export function routeOf(page: Page): string {
  if (!listed(page)) return pathOf.home;
  return `${pathOf[page.page]}${searchOf(page)}`;
}

function searchOf(page: Page) {
  const search = new URLSearchParams();
  if (page.page === "leaderboard" && page.period !== "week") search.set("period", page.period);
  if (page.page === "quests" && page.quest !== undefined) search.set("quest", String(page.quest));
  if (page.page === "skillTree" && page.perk !== undefined) search.set("perk", page.perk);
  if (page.crate !== undefined) search.set("crate", crateParamOf(page.crate));
  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}

export function listedPageOf(feature: Feature): Page | null {
  const page = featurePages[feature];
  return page !== undefined && listed(page) ? page : null;
}

export function readyCratePageOf(feature: Feature): Page {
  const page = listedPageOf(feature);
  return page === null ? { page: "home" } : { ...page, crate: feature };
}

export function questCratePageOf(quest: Quest): Page {
  if (quest.kind === "journey") return { page: "home", crate: "journey" };
  if (quest.kind === "weekly") return { page: "quests", quest: quest.slot };
  return { page: "quests" };
}

export const earlierWeekCratePage: Page = { page: "quests" };

export function weeklyCratePageOf(quest: WeeklyQuest, thisWeek: WeekKey): Page {
  return quest.week === thisWeek ? questCratePageOf(quest) : earlierWeekCratePage;
}

export function urlOf(origin: string, page: Page) {
  return `${origin}${routeOf(page)}`;
}
