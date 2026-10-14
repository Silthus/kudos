import "@fontsource-variable/inter";
import "./src/index.css";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import { shellFixtures, fixtureActions, type FeatureCard, type MemberProfile, type ShellState } from "./src/shell";
import { fixedLeaderboard, leaderboardFixtures } from "./src/leaderboardFixtures";
import { fixedQuests, questsFixtures } from "./src/questsFixtures";

const params = new URLSearchParams(location.search);
const mode = params.get("theme") ?? "light";
localStorage.setItem("hedgehug.theme", mode);
document.documentElement.classList.toggle("dark", mode === "dark");
const level = Number(params.get("level") ?? 8);
const ready = params.get("state") === "ready";
const cards = ([
 { feature: "quests", name: "Quests", opens: "your weekly quests", level: 2, seen: "audit-q" },
 { feature: "leaderboard", name: "Leaderboard", opens: "the boards", level: 3, seen: "audit-l" },
 { feature: "book", name: "The Book", opens: "achievements", level: 4, seen: "audit-b" },
 { feature: "skillTree", name: "Skill tree", opens: "the tree and your first skill point", level: 5, seen: "audit-s" },
] as const).map<FeatureCard>(card => ({ ...card, state: level < card.level ? "locked" : ready ? "ready" : "open", readyAt: level < card.level ? null : 1791795600000, openedAt: level < card.level || ready ? null : 1791882000000 }));
const member: MemberProfile = {
 ...shellFixtures.member, name: "Sam Example", face: { kind: "initials", initials: "SE" },
 kudosEmoji: "hedgehug", allowance: { left: 3, base: 5, refillsAt: Date.parse("2026-10-15T00:00:00Z") },
 lifetime: { given: 142, received: 97 }, thisWeek: { given: 12, received: 8 },
 progression: { level, xp: level === 8 ? 2470 : 0, levelStartsAt: level === 8 ? 2100 : 0, nextLevelAt: level === 8 ? 2800 : 20, xpToNextLevel: level === 8 ? 330 : 20 },
 features: cards, leaderboard: level < 3 ? { kind: "locked", level: 3 } : { kind: ready ? "ready" : "open" },
 journey: level < 3 ? shellFixtures.memberStartingTheJourney.journey : null,
};
const fixture = params.get("visitor");
const visitor: ShellState = fixture === "signed-out" ? shellFixtures.signedOut : fixture === "closed" ? shellFixtures.closed : member;
createRoot(document.getElementById("root")!).render(<App visitor={visitor} actions={fixtureActions} useLeaderboard={fixedLeaderboard(level < 3 ? { kind: "locked", level: 3 } : ready ? { kind: "ready" } : leaderboardFixtures.midBoard)} useQuests={fixedQuests(params.get("empty") ? questsFixtures.noDraw : level < 2 ? questsFixtures.locked : ready ? questsFixtures.ready : questsFixtures.week)}  />);
