import "./src/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { fixtureReadsFor } from "./src/fixtureReads";
import { shellFixtures, fixtureActions, type MemberProfile, type ShellActions, type Feature } from "./src/shell";
import type { BoardRead } from "./src/boardRead";
import { fixedQuests, questsFixtures } from "./src/questsFixtures";
import { bookFixtures, fixedBook } from "./src/bookFixtures";
import { fixedSkillTree, skillTreeFixtures } from "./src/skillTreeFixtures";

const params = new URLSearchParams(location.search);
history.replaceState(null, "", (params.get("path") ?? "/") + location.search);
const state = params.get("state") === "locked" ? "locked" : "ready";
const { memberWithEveryPanelLocked, memberWithEveryPanelReady } = shellFixtures;
let visitor: MemberProfile = { ...(state === "locked" ? memberWithEveryPanelLocked : memberWithEveryPanelReady), groups: params.get("groups") === "1" };
const board: BoardRead = (period) => period && (state === "locked" ? { kind: "locked", level: 3 } : { kind: "ready" });
const root = createRoot(document.getElementById("root")!);
const opened = (feature: Feature) => (visitor.features ?? []).map((card) => (card.feature === feature ? { ...card, state: "open" as const, openedAt: Date.now() } : card));
const actions: ShellActions = {
  ...fixtureActions,
  openFeature: async (feature) => {
    await new Promise((resolve) => setTimeout(resolve, Number(params.get("delay") ?? 300)));
    setTimeout(() => {
      visitor = { ...visitor, features: opened(feature) };
      show();
    }, 50);
    return { kind: "opened" };
  },
};
const show = () =>
  root.render(<App visitor={visitor} actions={actions} {...fixtureReadsFor(visitor)} useLeaderboard={board} useQuests={fixedQuests(questsFixtures[state])} useBook={fixedBook(bookFixtures[state])} useSkillTree={fixedSkillTree(skillTreeFixtures[state])} />);
show();
