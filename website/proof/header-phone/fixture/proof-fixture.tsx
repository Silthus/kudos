import "./src/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { fixtureReadsFor } from "./src/fixtureReads";
import { shellFixtures, fixtureActions, type MemberProfile } from "./src/shell";
import { fixedLeaderboard, leaderboardFixtures } from "./src/leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./src/questsFixtures";
import { bookFixtures, fixedBook } from "./src/bookFixtures";
import { fixedSkillTree, skillTreeFixtures } from "./src/skillTreeFixtures";

const params = new URLSearchParams(location.search);
history.replaceState(null, "", (params.get("path") ?? "/") + location.search);
const { memberWithQuests, memberWithEveryFeatureOpen } = shellFixtures;
const member: MemberProfile = {
  ...memberWithQuests,
  leaderboard: { kind: "open" },
  features: [...(memberWithQuests.features ?? []), ...(memberWithEveryFeatureOpen.features ?? [])],
  skillPoints: 2,
};
createRoot(document.getElementById("root")!).render(<App visitor={member} actions={fixtureActions} {...fixtureReadsFor(member)} useLeaderboard={fixedLeaderboard(leaderboardFixtures.midBoard)} useQuests={fixedQuests(questsFixtures.week)} useBook={fixedBook(bookFixtures.book)} useSkillTree={fixedSkillTree(skillTreeFixtures.withPoints)} />);

if (params.get("six") === "1") {
  const grow = () => {
    const nav = document.querySelector('nav[aria-label="Screens"]');
    if (!nav) return requestAnimationFrame(grow);
    const entry = nav.querySelector("a:not([aria-current])")!.cloneNode(true) as HTMLAnchorElement;
    entry.lastChild!.textContent = "Collection";
    entry.removeAttribute("href");
    nav.appendChild(entry);
  };
  grow();
}
