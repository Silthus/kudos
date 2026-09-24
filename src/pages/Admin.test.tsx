// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { describeElement, escapesFromScrollers } from "@/testing/layout";

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
  gameEnabled: false,
};
const overview = {
  workspace: { _id: "w1", name: "Lumen Labs", isDemo: false, slackTeamId: "T1" },
  settings,
  storeEnabled: false,
  slack: {},
};
const members = ["Alex Rivera", "Lena Park"].map((name, i) => ({
  _id: `m${i}`,
  name,
  title: null,
  slackUserId: `U${i}`,
  avatarUrl: null,
  deactivated: false,
  isAdmin: i === 0,
  signedIn: true,
  totalGiven: 12,
  totalReceived: 7,
  balance: 7,
  totalMaxedDays: 1,
  lastGivenAt: null,
}));
const saved = vi.fn(async (_args: unknown) => null);

vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "admin:overview": overview, "admin:members": members })[getFunctionName(fn)],
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

test("switching the game on and saving sends it with the other settings, and says what switching on does", async () => {
  const gameSwitch = () => host.querySelector<HTMLButtonElement>('[role=switch][aria-label="The game"]');
  expect(gameSwitch()?.getAttribute("aria-checked")).toBe("false");
  expect(host.textContent).toContain("Switching it on plays the kudos history so far through the rules");
  act(() => gameSwitch()!.click());
  await act(async () => button("Save settings").click());
  expect(saved).toHaveBeenCalledWith({ ...settings, gameEnabled: true });
});

test("admins see Hog coin balances while the game is on, whatever their own level (the ledger is how they adjust coins)", () => {
  // storeEnabled is the viewing admin's own Store access (level 3+); it must not hide other people's balances.
  const viewer = { member: { _id: "m0", name: "Alex Rivera", isAdmin: true }, workspace: { isDemo: false, storeEnabled: false, gameEnabled: true } } as unknown as ReadyViewer;
  act(() => root.unmount());
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/admin?tab=members"]}>
        <ViewerContext.Provider value={viewer}>
          <Admin />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  const ledger = host.querySelector<HTMLButtonElement>("button[aria-label=\"Lena Park's balance: 7. Open ledger\"]");
  expect(ledger).not.toBeNull();
  expect(ledger!.title).toContain("Hog coins");
});

test("on a phone the members table scrolls inside its card, and nothing in it widens the page", () => {
  const viewer = { member: { _id: "m0", name: "Alex Rivera", isAdmin: true }, workspace: { isDemo: false, storeEnabled: true } } as unknown as ReadyViewer;
  act(() => root.unmount());
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={["/admin?tab=members"]}>
        <ViewerContext.Provider value={viewer}>
          <Admin />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector("table")?.textContent).toContain("Lena Park");
  expect(host.querySelector("table")!.parentElement!.classList, "the wide table scrolls sideways on its own").toContain("overflow-x-auto");
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
});
