// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { Scoreboard, type Row } from "./parts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
afterEach(() => container?.remove());

function render(rows: Row[], benchmarkLabel: string) {
  container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container).render(
      <Scoreboard rows={rows} benchmarkLabel={benchmarkLabel} subtitle="This week so far" deltaHeader="Change" renderDelta={() => null} />,
    ),
  );
  const desktop = [...container.querySelectorAll("tbody tr")].map((tr) => tr.textContent);
  return { desktop, text: container.textContent ?? "" };
}

const quests = (you: Row["you"], benchmark: Row["benchmark"], delta: number | null = null): Row => ({
  metric: "questsCompleted",
  family: "giving",
  you,
  benchmark,
  delta,
});

test("Past you: your quests completed against last period, with both numbers printed", () => {
  const { desktop } = render([quests({ value: 3, locked: null }, { value: 1, locked: null }, 2)], "Last week");
  expect(desktop).toHaveLength(1);
  expect(desktop[0]).toContain("Quests completed");
  expect(desktop[0]).toContain("3");
  expect(desktop[0]).toContain("1");
});

test("a teammate's quests: the row explains they're private and shows no number", () => {
  const { desktop } = render([quests({ value: null, locked: "personal" }, { value: null, locked: "personal" })], "Ben");
  expect(desktop[0]).toContain("Quests completed");
  expect(desktop[0]).toContain("Quests are private to each member");
  expect(desktop[0]).not.toMatch(/\d/);
});
