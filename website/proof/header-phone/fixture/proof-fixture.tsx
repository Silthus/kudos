import "@fontsource-variable/inter";
import "./src/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { shellFixtures, fixtureActions, type MemberProfile } from "./src/shell";
import { fixedLeaderboard, leaderboardFixtures } from "./src/leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./src/questsFixtures";

const params = new URLSearchParams(location.search);
history.replaceState(null, "", (params.get("path") ?? "/") + location.search);
const { memberWithQuests, memberWithEveryFeatureReady } = shellFixtures;
const member: MemberProfile = {
  ...memberWithQuests,
  leaderboard: { kind: "open" },
  features: [...(memberWithQuests.features ?? []), { ...memberWithEveryFeatureReady.features![0], state: "open" }, memberWithEveryFeatureReady.features![1]],
};
createRoot(document.getElementById("root")!).render(<App visitor={member} actions={fixtureActions} useLeaderboard={fixedLeaderboard(leaderboardFixtures.midBoard)} useQuests={fixedQuests(questsFixtures.week)} />);

if (params.get("six") === "1") {
  const grow = () => {
    const nav = document.querySelector('nav[aria-label="Screens"]');
    const pill = document.querySelector("header button[aria-disabled], header .ml-auto > button");
    if (!nav || !pill) return requestAnimationFrame(grow);
    const template = nav.querySelector("a:not([aria-current])")!;
    for (const name of ["The Book", "Skill tree", "Collection"]) {
      const entry = template.cloneNode(true) as HTMLAnchorElement;
      entry.lastChild!.textContent = name;
      entry.removeAttribute("href");
      nav.appendChild(entry);
    }
    const chip = pill.cloneNode(true) as HTMLElement;
    chip.setAttribute("aria-label", "3 skill points to spend");
    pill.before(chip);
  };
  grow();
}
