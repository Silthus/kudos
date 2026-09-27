// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";
import { setWorkspaceClock } from "@/lib/format";

/**
 * The blight stone's window (#164): the blight's meter in blight purple, the days it has left, your
 * damage, how many defend the tree, "Join the raid" while it's here, and the blights that came before.
 */

let queries: Record<string, unknown> = {};
const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "rpg:startRaid": vi.fn(async () => "e1"),
  "rpg:act": vi.fn(async () => null),
  "rpg:abandon": vi.fn(async () => null),
};
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">, args: unknown) => (args === "skip" ? undefined : queries[getFunctionName(fn)]),
  useMutation: (fn: FunctionReference<"mutation">) => mutations[getFunctionName(fn)],
}));

const { Blight } = await import("./Blight");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  queries = {};
  for (const m of Object.values(mutations)) m.mockClear();
  vi.useRealTimers();
});

const viewer = { member: { _id: "m_alex", name: "Alex" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
const DAY = 86_400_000;
const NOW = Date.parse("2026-09-23T10:00:00Z");
const blight = (over: Record<string, unknown> = {}) => ({
  _id: "b1",
  number: 2,
  status: "active",
  arrivesAt: NOW - DAY,
  endsAt: Date.parse("2026-09-26T22:00:00Z"),
  endedAt: null,
  hp: 120,
  damage: 42,
  contributors: 5,
  tier: 1,
  bonusDay: null,
  mine: 12,
  ...over,
});
const past = [
  { ...blight({ _id: "b0", number: 1, status: "won", damage: 80, hp: 80, contributors: 7, mine: 9, endedAt: Date.parse("2026-09-21T12:00:00Z"), bonusDay: "2026-09-22" }) },
];

let tree: () => React.ReactNode = () => null;
const rerender = () => act(() => root!.render(tree()));

function render() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  setWorkspaceClock(0);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  tree = () => (
      <MemoryRouter initialEntries={["/blight"]}>
        <ViewerContext.Provider value={viewer}>
          <div data-window-body className="@container pixel-frame">
            <Routes>
              <Route path="/blight" element={<Blight />} />
            </Routes>
          </div>
        </ViewerContext.Provider>
      </MemoryRouter>
  );
  rerender();
  return host;
}

describe("while a blight is at the tree", () => {
  test("shows its meter, the days it has left, your damage and the company's, and the way into the raid", () => {
    queries = { "blights:current": { blight: blight(), lanternsDimUntil: null }, "blights:history": past, "rpg:current": { stamina: 2, level: 4, run: null } };
    const host = render();
    const text = host.textContent ?? "";
    expect(text).toContain("A blight is at the tree");
    const meter = host.querySelector("[role='progressbar']");
    expect(meter?.getAttribute("aria-label")).toBe("The blight: 78 of 120 left");
    expect(meter?.innerHTML).toContain("var(--color-blight)");
    expect(text).toContain("4 days left");
    expect(text).toContain("You dealt it 12.");
    expect(text).toContain("5 teammates are defending the tree.");
    const join = [...host.querySelectorAll("button")].find((b) => b.textContent === "Join the raid")!;
    expect(join.disabled).toBe(false);
    act(() => join.click());
    expect(mutations["rpg:startRaid"]).toHaveBeenCalledWith({});
    expect(windowPageProblems(host)).toEqual([]);
  });

  test("without stamina the raid waits, and says how to get some", () => {
    queries = { "blights:current": { blight: blight({ mine: 0 }), lanternsDimUntil: null }, "blights:history": [], "rpg:current": { stamina: 0, level: 4, run: null } };
    const host = render();
    expect([...host.querySelectorAll("button")].find((b) => b.textContent === "Join the raid")?.disabled).toBe(true);
    expect(host.textContent).toContain("Every thoughtful kudos you give restores one stamina");
    expect(host.textContent).toContain("You haven't struck it yet.");
  });

  test("a blight nobody has struck asks for the first blow", () => {
    queries = { "blights:current": { blight: blight({ mine: 0, contributors: 0, damage: 0 }), lanternsDimUntil: null }, "blights:history": [], "rpg:current": { stamina: 2, level: 4, run: null } };
    expect(render().textContent).toContain("Nobody has struck it yet. Be the first.");
  });
});

describe("a raid under way", () => {
  test("goes on to its end after the blight is beaten mid-run", () => {
    const run = {
      id: "e1",
      ruinId: "raid:1",
      name: "The blight's hollow",
      tier: 1,
      open: true,
      state: "open",
      room: 2,
      rooms: [{ kind: "puzzle" }, { kind: "puzzle" }, { kind: "foe", foe: "blight_sprout" }],
      turn: 0,
      foe: { id: "blight_sprout", name: "Blight sprout", about: "A shoot of the blight.", hp: 9, maxHp: 9, weakness: "heart" },
      party: [{ memberId: "m_alex", name: "Alex", level: 9, hp: 14, maxHp: 18, stats: { might: 9, wits: 5, heart: 3 }, chosen: false, left: false, you: true }], leader: true, invited: [], decideBy: null,
      puzzle: null,
      log: [],
      loot: { coins: 0, fruits: [], gear: [], lore: [] },
    };
    queries = { "blights:current": { blight: past[0], lanternsDimUntil: null }, "blights:history": past, "rpg:current": { stamina: 1, level: 9, run } };
    const host = render();
    expect(host.textContent).toContain("The blight is beaten");
    expect(host.querySelector("[data-expedition]")).not.toBeNull();
    expect([...host.querySelectorAll("button")].some((b) => b.textContent?.startsWith("Strike"))).toBe(true);
  });

  test("once it's over, the stone shows how the raid you were in went; never an older one's", () => {
    const done = { id: "e1", ruinId: "raid:1", name: "The blight's hollow", tier: 1, open: false, state: "cleared", room: 2, rooms: [{ kind: "puzzle" }, { kind: "puzzle" }, { kind: "foe", foe: "blight_sprout" }], turn: 0, foe: null, party: [], puzzle: null, log: [], loot: { coins: 13, fruits: [], gear: [], lore: [] } };
    queries = { "blights:current": { blight: past[0], lanternsDimUntil: null }, "blights:history": past, "rpg:current": { stamina: 1, level: 9, run: done } };
    const host = render();
    expect(host.querySelector("[data-room-strip]")).toBeNull();
    queries = { ...queries, "rpg:current": { stamina: 1, level: 9, run: { ...done, open: true, state: "open", foe: { id: "blight_sprout", name: "Blight sprout", about: "", hp: 1, maxHp: 9, weakness: "heart" }, party: [{ memberId: "m_alex", name: "Alex", level: 9, hp: 14, maxHp: 18, stats: { might: 9, wits: 5, heart: 3 }, chosen: false, left: false, you: true }], leader: true, invited: [], decideBy: null } } };
    rerender();
    queries = { ...queries, "rpg:current": { stamina: 1, level: 9, run: done } };
    rerender();
    expect(host.querySelector("[data-room-strip]")).not.toBeNull();
    expect(host.textContent).toContain("13");
  });
});

describe("before and after", () => {
  test("an announced blight says when it comes", () => {
    queries = { "blights:current": { blight: blight({ status: "announced", arrivesAt: Date.parse("2026-09-24T22:00:00Z"), hp: 0, damage: 0 }), lanternsDimUntil: null }, "blights:history": [], "rpg:current": null };
    const host = render();
    expect(host.textContent).toContain("A blight is coming");
    expect(host.textContent).toContain("It reaches the tree on Friday, 25 September.");
    expect(host.querySelector("[role='progressbar']")).toBeNull();
  });

  test("a beaten blight calls its bonus day, and the history lists the blights that came, with their crests", () => {
    queries = { "blights:current": { blight: past[0], lanternsDimUntil: null }, "blights:history": past, "rpg:current": null };
    const host = render();
    expect(host.textContent).toContain("The blight is beaten");
    expect(host.textContent).toContain("A bonus day is called for Tuesday, 22 September.");
    const history = host.querySelector("[data-blight-history]")!;
    expect(history.textContent).toContain("Blight 1: beaten on Monday, 21 September");
    expect(history.textContent).toContain("80 of 80 worn down by 7 teammates. You dealt it 9.");
    expect(history.querySelector("[data-crest]")).not.toBeNull();
  });

  test("a blight nobody struck says so in the history", () => {
    const lost = blight({ _id: "b3", number: 3, status: "lost", damage: 0, contributors: 0, mine: 0, endedAt: NOW - DAY });
    queries = { "blights:current": { blight: lost, lanternsDimUntil: NOW + 6 * DAY }, "blights:history": [lost], "rpg:current": null };
    const host = render();
    expect(host.textContent).toContain("The blight outlasted us");
    expect(host.querySelector("[data-blight-history]")?.textContent).toContain("Blight 3: outlasted us on Tuesday, 22 September");
    expect(host.querySelector("[data-blight-history]")?.textContent).toContain("Nobody struck it.");
  });

  test("how the last one ended is news for a week; then the stone waits for the next", () => {
    queries = { "blights:current": { blight: { ...past[0], endedAt: Date.parse("2026-09-10T12:00:00Z") }, lanternsDimUntil: null }, "blights:history": past, "rpg:current": null };
    const host = render();
    expect(host.textContent).toContain("No blight is at the tree");
    expect(host.textContent).not.toContain("The blight is beaten");
  });

  test("with no blight yet, it says how they come", () => {
    queries = { "blights:current": { blight: null, lanternsDimUntil: null }, "blights:history": [], "rpg:current": null };
    const host = render();
    expect(host.textContent).toContain("No blight is at the tree");
    expect(host.textContent).toContain("every two to four weeks");
  });
});
