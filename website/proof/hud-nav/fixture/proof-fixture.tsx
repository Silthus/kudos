import "@fontsource-variable/inter";
import "./src/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { fixtureReadsFor } from "./src/fixtureReads";
import { shellFixtures, fixtureActions, type MemberProfile, type ShellActions } from "./src/shell";
import { fixedLeaderboard, leaderboardFixtures } from "./src/leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./src/questsFixtures";
import { bookFixtures, fixedBook } from "./src/bookFixtures";
import { fixedSkillTree, skillTreeFixtures } from "./src/skillTreeFixtures";

const params = new URLSearchParams(location.search);
history.replaceState(null, "", (params.get("path") ?? "/") + location.search);
const { memberWithEveryNavState, memberWithEveryFeatureOpen } = shellFixtures;
const opened = memberWithEveryNavState.features!.map((card) => (card.feature === "leaderboard" ? { ...card, state: "open" as const, openedAt: Date.now() } : card));
const states: Record<string, MemberProfile> = {
  every: { ...memberWithEveryNavState, skillPoints: 2 },
  open: { ...memberWithEveryFeatureOpen, features: [...memberWithEveryNavState.features!.slice(0, 1).map((card) => ({ ...card, state: "open" as const })), ...memberWithEveryFeatureOpen.features!] },
};
const root = createRoot(document.getElementById("root")!);
let visitor = states[params.get("state") ?? "every"]!;
const actions: ShellActions = {
  ...fixtureActions,
  openFeature: async () => {
    setTimeout(() => {
      visitor = { ...visitor, features: opened, leaderboard: { kind: "open" } };
      show();
    }, 50);
    return { kind: "opened" };
  },
};
const show = () =>
  root.render(<App visitor={visitor} actions={actions} {...fixtureReadsFor(visitor)} useLeaderboard={fixedLeaderboard(leaderboardFixtures.midBoard)} useQuests={fixedQuests(questsFixtures.week)} useBook={fixedBook(bookFixtures.book)} useSkillTree={fixedSkillTree(skillTreeFixtures.withPoints)} />);
show();

if (params.get("six") === "1") {
  const grow = () => {
    const nav = document.querySelector('nav[aria-label="Screens"]');
    const locked = [...(nav?.querySelectorAll('[role="link"][aria-disabled="true"]:not([data-clone])') ?? [])].at(-1);
    if (!nav || !locked) return requestAnimationFrame(grow);
    const entry = locked.cloneNode(true) as HTMLElement;
    entry.dataset.clone = "";
    entry.setAttribute("aria-label", "Collection, locked. Unlocks at level 9");
    entry.querySelector("[data-entry-label]")!.textContent = "Collection";
    entry.querySelector(".rounded-full.border")?.remove();
    nav.appendChild(entry);
  };
  grow();
}
