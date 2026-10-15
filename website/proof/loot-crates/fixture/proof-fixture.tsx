import "./src/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { fixtureReadsFor } from "./src/fixtureReads";
import { fixedQuests, questsFixtures } from "./src/questsFixtures";
import { fixtureActions, shellFixtures, type Drop, type MemberProfile, type MyQuests, type OpenAnswer, type ShellActions } from "./src/shell";

const params = new URLSearchParams(location.search);
history.replaceState(null, "", (params.get("path") ?? "/") + location.search);

const drops: Record<string, Drop> = {
  epic: { hoggie: "wizard", name: "Wizard", rarity: "epic", art: { kind: "hoggie", slug: "wizard" }, copy: 1, isNew: true },
  legendary: { hoggie: "superhero", name: "Superhero", rarity: "legendary", art: { kind: "hoggie", slug: "superhero" }, copy: 1, isNew: true },
  common: { hoggie: "angel", name: "Angel", rarity: "common", art: { kind: "hoggie", slug: "angel" }, copy: 3, isNew: false },
  rare: { hoggie: "rocket", name: "Rocket", rarity: "rare", art: { kind: "hoggie", slug: "rocket" }, copy: 1, isNew: true },
};

const drop = drops[params.get("drop") ?? ""];
const featureCrate = params.get("crate") === "feature";
const skillTreeReady = shellFixtures.memberWithTheSkillTreeReady;
let visitor: MemberProfile = featureCrate ? { ...skillTreeReady, progression: { level: 5, xp: 610, levelStartsAt: 600, nextLevelAt: 1000, xpToNextLevel: 390 }, coins: 236 } : { ...shellFixtures.memberCrossingIntoLevel6, coins: params.get("coins") === "0" ? null : 236 };
const quests: MyQuests = params.get("coins") === "0" ? questsFixtures.week : questsFixtures.weekPayingCoins;
const delayMs = Number(params.get("delay") ?? 400);
const root = createRoot(document.getElementById("root")!);

const answer = async (): Promise<OpenAnswer> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { kind: "opened", ...(drop !== undefined && { drop }) };
};

const openFeature: ShellActions["openFeature"] = async (feature) => {
  const answered = await answer();
  setTimeout(() => {
    visitor = { ...visitor, features: (visitor.features ?? []).map((card) => (card.feature === feature ? { ...card, state: "open", openedAt: Date.now() } : card)), skillPoints: 1 };
    show();
  }, 50);
  return answered;
};

const actions: ShellActions = { ...fixtureActions, openQuestCrate: answer, openFeature };

const show = () => root.render(<App visitor={visitor} actions={actions} {...fixtureReadsFor(visitor)} useQuests={fixedQuests(quests)} />);
show();
