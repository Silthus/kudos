// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";
import { copyTells } from "@/testing/windowPage";
import { QuestBoardBody, type QuestBoard } from "./quests";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));

function render(node: React.ReactNode) {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter>{node}</MemoryRouter>));
  return host;
}

const quest = (key: string, title: string, over: Partial<QuestBoard["quests"][number]> = {}) => ({
  key,
  title,
  description: `${title} description`,
  group: "people",
  progress: 0,
  goal: 1,
  status: "active" as const,
  waivedReason: null,
  completedAt: null,
  messageRarity: null,
  ...over,
});
const rewards = { weekly: { xp: 20, coins: 5 }, daily: { xp: 10, coins: 2 }, sweep: { xp: 30, coins: 0 } };
const daily = {
  key: "detail",
  title: "Tell the story",
  description: "Write a reason of 12+ words in one kudos",
  dayKey: "2026-09-23",
  progress: 0,
  goal: 1,
  status: "active" as const,
  completedAt: null,
};
const board: QuestBoard = {
  enabled: true,
  weekKey: "2026-09-21",
  weekStart: "2026-09-21",
  weekEnd: "2026-09-27",
  resetsAt: 0,
  quests: [quest("fresh", "New connection"), quest("steady", "Steady hand", { goal: 3 })],
  completed: 0,
  available: 2,
  sweep: false,
  locked: null,
  daily: null,
  rewards: null,
};

test("with the game off the board is as before: no daily quest and no XP or coins", () => {
  const host = render(<QuestBoardBody board={board} />);
  expect(host.textContent).toContain("New connection");
  expect(host.textContent).not.toContain("Today's quest");
  expect(host.textContent).not.toMatch(/XP|Hog coin/);
});

test("from level 5 today's daily quest sits under the board and each shows what it pays", () => {
  const host = render(<QuestBoardBody board={{ ...board, daily: { ...daily, progress: 1, status: "done", completedAt: Date.now() }, rewards }} />);
  const today = host.querySelector("[data-daily-quest]")!;
  expect(today.textContent).toContain("Today's quest");
  expect(today.textContent).toContain("Tell the story");
  expect(today.textContent).toContain("Pays 10 XP and 2 Hog coins");
  expect(today.querySelector("[data-done]")).not.toBeNull();
  expect(host.textContent).toContain("Each weekly quest pays 20 XP and 5 Hog coins. A clean sweep pays 30 XP more.");
  expect(copyTells(host)).toEqual([]);
});

test("below level 5 the board and the daily quest are visible but locked, with how to get there", () => {
  const host = render(<QuestBoardBody board={{ ...board, locked: { level: 5, current: 3 }, daily, rewards }} />);
  expect(host.querySelector("[data-locked]")?.getAttribute("aria-label")).toBe("Quests, opens at level 5");
  expect(host.textContent).toContain("You're level 3");
  // The quests are listed by name, without progress to chase yet.
  expect(host.textContent).toContain("New connection");
  expect(host.textContent).toContain("Tell the story");
  expect(host.textContent).not.toContain("0/1");
  expect(host.querySelector("[role=progressbar]")).toBeNull();
});
