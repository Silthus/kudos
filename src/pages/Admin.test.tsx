// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const settings = {
  emojiName: "taco",
  emojiGlyph: "🌮",
  unitSingular: "kudos",
  unitPlural: "kudos",
  dailyLimit: 5,
  timezone: "Europe/Berlin",
  receivedVisibility: "self",
  reactionsEnabled: true,
  notifyGiver: true,
  notifyReceiver: true,
  questsEnabled: true,
};
const overview = {
  workspace: { _id: "w1", name: "Lumen Labs", isDemo: false, slackTeamId: "T1" },
  settings,
  storeEnabled: false,
  slack: {},
};
const saved = vi.fn(async (_args: unknown) => null);

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => (getFunctionName(fn) === "admin:overview" ? overview : undefined),
  useMutation: (fn: FunctionReference<"mutation">) => (getFunctionName(fn) === "admin:updateSettings" ? saved : vi.fn()),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
}));

const { Admin } = await import("./Admin");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Admin />
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  saved.mockClear();
});

const questsSwitch = () => host.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Weekly quests"]');
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;

test("the settings tab has a Weekly quests switch that says what quests are", () => {
  expect(questsSwitch()?.getAttribute("aria-checked")).toBe("true");
  expect(host.textContent).toContain(
    "Private weekly goals that nudge members toward thoughtful, spread-out recognition. Rewards are collectible messages only.",
  );
});

test("switching quests off and saving sends the setting with the others", async () => {
  act(() => questsSwitch()!.click());
  expect(questsSwitch()!.getAttribute("aria-checked")).toBe("false");
  await act(async () => button("Save settings").click());
  expect(saved).toHaveBeenCalledWith({ ...settings, questsEnabled: false });
});
