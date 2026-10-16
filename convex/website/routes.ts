import { v, type Infer } from "convex/values";
import { weeklyQuestValidator, type GroupQuestCrate, type Quest, type WeeklyQuest } from "../quests/step";
import type { WeekKey } from "../quests/week";
import { featureValidator, type Feature } from "../unlocks/feature";
import type { pageValidator } from "./link";

export type Page = Infer<typeof pageValidator>;

type CratePage = Extract<Page, { crate?: CrateTarget }>;

const namedCrateValidator = v.union(...featureValidator.members, v.literal("journey"), v.literal("group"), v.literal("store"));

type NamedCrate = Infer<typeof namedCrateValidator>;

const earlierGroupCrateValidator = v.object({ kind: v.literal("group"), week: v.string() });

const boughtCrateValidator = v.object({ kind: v.literal("bought"), n: v.number() });

export type BoughtCrateTarget = Infer<typeof boughtCrateValidator>;

export const crateTargetValidator = v.union(...namedCrateValidator.members, weeklyQuestValidator, earlierGroupCrateValidator, boughtCrateValidator);

export type CrateTarget = Infer<typeof crateTargetValidator>;

const namedCrates: readonly NamedCrate[] = namedCrateValidator.members.map(({ value }) => value);

const weeklyCrateParam = /^weekly:(\d{4}-\d{2}-\d{2}):(\d+)$/;

const earlierGroupCrateParam = /^group:(\d{4}-\d{2}-\d{2})$/;

const boughtCrateParam = /^bought:(\d+)$/;

export function crateParamOf(crate: CrateTarget): string | undefined {
  if (typeof crate === "string") return crate;
  if (crate.kind === "weekly") return `weekly:${crate.week}:${crate.slot}`;
  if (crate.kind === "group") return `group:${crate.week}`;
  return isACrateNumber(crate.n) ? `bought:${crate.n}` : undefined;
}

export function crateTargetIn(param: string | null): CrateTarget | undefined {
  if (param === null) return undefined;
  return namedCrates.find((crate) => crate === param) ?? weeklyCrateIn(param) ?? earlierGroupCrateIn(param) ?? boughtCrateIn(param);
}

function weeklyCrateIn(param: string): CrateTarget | undefined {
  const weekly = weeklyCrateParam.exec(param);
  return weekly === null ? undefined : { kind: "weekly", week: weekly[1]!, slot: Number(weekly[2]) };
}

function boughtCrateIn(param: string): CrateTarget | undefined {
  const bought = boughtCrateParam.exec(param);
  const n = bought === null ? 0 : Number(bought[1]);
  return isACrateNumber(n) ? { kind: "bought", n } : undefined;
}

function isACrateNumber(n: number) {
  return Number.isSafeInteger(n) && n > 0;
}

export function boughtCrateTargetOf(crate: string): BoughtCrateTarget | undefined {
  const target = crateTargetIn(crate);
  return typeof target === "object" && target.kind === "bought" ? target : undefined;
}

function earlierGroupCrateIn(param: string): CrateTarget | undefined {
  const group = earlierGroupCrateParam.exec(param);
  return group === null ? undefined : { kind: "group", week: group[1]! };
}

export const routeList: readonly string[] = ["/", "/leaderboard", "/quests", "/skills", "/book", "/book/earned", "/book/collection", "/activity", "/settings"];

export const signInEntry = "/sign-in";

const pathOf: Record<Page["page"], string> = {
  home: "/",
  leaderboard: "/leaderboard",
  quests: "/quests",
  skillTree: "/skills",
  book: "/book",
  bookEarned: "/book/earned",
  bookCollection: "/book/collection",
  settings: "/settings",
};

const featurePages: Partial<Record<Feature, CratePage>> = {
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
  const crate = "crate" in page && page.crate !== undefined ? crateParamOf(page.crate) : undefined;
  if (crate !== undefined) search.set("crate", crate);
  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}

export function listedPageOf(feature: Feature): CratePage | null {
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
  return { page: "quests", crate: "group" };
}

export function boughtCratePageOf(crate: string): Page {
  const target = boughtCrateTargetOf(crate);
  return target === undefined ? { page: "bookCollection" } : { page: "bookCollection", crate: target };
}

export function crateOfferPageOf(): Page {
  return { page: "bookCollection", crate: "store" };
}

export function earlierWeekCratePageOf(quest: WeeklyQuest | GroupQuestCrate): Page {
  if (quest.kind === "group") return { page: "quests", crate: { kind: "group", week: quest.week } };
  return { page: "quests", crate: { kind: "weekly", week: quest.week, slot: quest.slot } };
}

export function weeklyCratePageOf(quest: WeeklyQuest, thisWeek: WeekKey): Page {
  return quest.week === thisWeek ? questCratePageOf(quest) : earlierWeekCratePageOf(quest);
}

export function urlOf(origin: string, page: Page) {
  return `${origin}${routeOf(page)}`;
}
