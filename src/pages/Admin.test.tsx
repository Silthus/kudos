// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { describeElement, escapesFromScrollers, parchmentTextOnDusk } from "@/testing/layout";
import { InWindow, windowPageProblems } from "@/testing/windowPage";

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
  spreesEnabled: false,
};
const overview = {
  workspace: { _id: "w1", name: "Lumen Labs", isDemo: false, slackTeamId: "T1" },
  settings,
  storeEnabled: false,
  slack: {
    connected: true,
    botUserId: "B1",
    signingSecretConfigured: true,
    oauthConfigured: true,
    endpoints: {
      events: "https://kudos.example/slack/events",
      commands: "https://kudos.example/slack/commands",
      interactions: "https://kudos.example/slack/interactions",
      install: "https://kudos.example/slack/install",
      manifest: "https://kudos.example/slack/manifest",
    },
  },
};
const request = {
  _id: "r1",
  requester: { _id: "m1", name: "Lena Park", avatarUrl: null, deactivated: false },
  rewardEmoji: "☕",
  rewardName: "Coffee on us",
  status: "pending",
  cost: 40,
  legacy: false,
  requestedAt: Date.now() - 3_600_000,
  balance: 12,
  negativeBalance: false,
  answer: null,
  prompt: null,
  canDecide: true,
  isOwn: false,
  history: [],
};
const reward = {
  _id: "rw1",
  status: "active",
  name: "Coffee on us",
  emoji: "☕",
  cost: 40,
  stock: 5,
  maxPerMember: 1,
  openCount: 1,
  fulfilledCount: 3,
  pricedInKudos: false,
  description: "A flat white downstairs",
};
const queries: Record<string, unknown> = {
  "storeAdmin:openCount": 1,
  "storeAdmin:rewards": [reward],
  "storeAdmin:overview": { enabled: true, gameEnabled: true, activeRewards: 1, unpricedRewards: 0, totalBalance: 900, medianBalance: 40 },
  "boosts:admin": {
    isDemo: false,
    maxAheadDays: 60,
    channel: null,
    boosts: [{ _id: "b1", dayKey: "2099-01-01", kind: "double", source: "schedule", by: "Alex Rivera", text: "Tomorrow is a bonus day.", announcement: null }],
  },
};
const pages: Record<string, unknown[]> = {
  "storeAdmin:redemptions": [request],
  "admin:recentKudos": [{ _id: "k1", giver: { name: "Alex Rivera", avatarUrl: null }, receiver: { name: "Lena Park", avatarUrl: null }, amount: 2, channel: "general", text: "Thanks for the review", at: Date.now() }],
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
  useQuery: (fn: FunctionReference<"query">) => ({ "admin:overview": overview, "admin:members": members, ...queries })[getFunctionName(fn)],
  useMutation: (fn: FunctionReference<"mutation">) => (getFunctionName(fn) === "admin:updateSettings" ? saved : vi.fn()),
  useAction: () => async () => [],
  usePaginatedQuery: (fn: FunctionReference<"query">) => ({ results: pages[getFunctionName(fn)] ?? [], status: "Exhausted", loadMore: vi.fn() }),
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

test("with the game on: the game's emoji to upload to Slack (#98)", () => {
  const gameSwitch = () => host.querySelector<HTMLButtonElement>('[role=switch][aria-label="The game"]');
  expect(host.textContent).not.toContain(":taco-super:");
  act(() => gameSwitch()!.click());
  for (const code of [":taco-super:", ":taco-golden:", ":taco-rainbow:", ":taco-sparkle:", ":taco-heart:"]) expect(host.textContent).toContain(code);
});

test("sprees have their own switch, off by default, and work with the game off (#94)", async () => {
  const spreesSwitch = () => host.querySelector<HTMLButtonElement>('[role=switch][aria-label="Kudos sprees"]');
  expect(spreesSwitch()?.getAttribute("aria-checked")).toBe("false");
  expect(host.textContent).toContain("Teammates join a thoughtful kudos by clicking the bot's reaction");
  act(() => spreesSwitch()!.click());
  await act(async () => button("Save settings").click());
  expect(saved).toHaveBeenCalledWith({ ...settings, spreesEnabled: true });
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
          <InWindow><Admin /></InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector("table")?.textContent).toContain("Lena Park");
  expect(host.querySelector("table")!.parentElement!.classList, "the wide table scrolls sideways on its own").toContain("overflow-x-auto");
  expect(escapesFromScrollers(host).map(describeElement)).toEqual([]);
  expect(parchmentTextOnDusk(host).map(describeElement)).toEqual([]);
});

// The gatehouse (#132): Admin in its place's window.
const admin = { member: { _id: "m0", name: "Alex Rivera", isAdmin: true }, workspace: { isDemo: false, storeEnabled: true, gameEnabled: true, emojiGlyph: "🌮" } } as unknown as ReadyViewer;
let location = "";
function Where() {
  location = useLocation().search;
  return null;
}
function inWindow(url: string) {
  act(() => root.unmount());
  root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <ViewerContext.Provider value={admin}>
          <InWindow>
            <Admin />
          </InWindow>
          <Where />
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
}

test("the gatehouse's rooms are pixel tabs kept in ?tab=, settings first", () => {
  inWindow("/admin");
  const tabs = [...host.querySelectorAll("[role=tablist][aria-label='Gatehouse'] [role=tab]")] as HTMLButtonElement[];
  expect(tabs.map((t) => t.textContent)).toEqual(["Settings", "Members", "Moderation", "Store", "Bonus days", "Slack"]);
  act(() => tabs[3].click());
  expect(location).toBe("?tab=store");
  expect(host.textContent).toContain("Coffee on us");
  act(() => tabs[0].click());
  expect(location).toBe("");
});

test("the Slack room lists every endpoint to copy, and the manifest", () => {
  inWindow("/admin?tab=slack");
  const rows = [...host.querySelectorAll("[data-endpoint]")].map((r) => r.textContent);
  expect(rows).toHaveLength(5);
  expect(rows.at(-1)).toContain("App manifest");
  expect(rows.at(-1)).toContain("https://kudos.example/slack/manifest");
});

test.each([
  "/admin",
  "/admin?tab=members",
  "/admin?tab=moderation",
  "/admin?tab=store",
  "/admin?tab=store&section=catalog",
  "/admin?tab=store&section=settings",
  "/admin?tab=boosts",
  "/admin?tab=slack",
])("%s lays out by the window, reads on parchment and has no page sign", (url) => {
  inWindow(url);
  expect(windowPageProblems(host)).toEqual([]);
});
