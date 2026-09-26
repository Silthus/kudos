// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * The crew's plaque (#161, plan #152 S6): the open quests with their progress and "Add coins", the
 * catalogue to propose from with a picture of each part and its options, and the plaque of what the
 * crew built with the names of everyone who gave.
 */

let open: unknown;
let built: unknown;
const contribute = vi.fn();
const propose = vi.fn();
const approve = vi.fn();
const withdraw = vi.fn();
const updateSettings = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "crew:open": open, "crew:built": built })[getFunctionName(fn)],
  useMutation: (fn: FunctionReference<"mutation">) =>
    ({ "crew:contribute": contribute, "crew:propose": propose, "crew:approveBanner": approve, "crew:withdraw": withdraw, "crew:updateSettings": updateSettings })[getFunctionName(fn)],
}));

const { Crew, CrewNotice, CrewSettings } = await import("./Crew");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const quest = (patch: Record<string, unknown> = {}) => ({
  _id: "q1",
  part: "structure_market_awnings",
  kind: "structure",
  name: "Market awnings",
  option: null,
  text: null,
  goal: 500,
  contributed: 300,
  contributors: 4,
  status: "proposed",
  awaitingApproval: false,
  proposedBy: "Priya Raman",
  proposedByMe: false,
  fundedAt: null,
  buildsAt: null,
  mine: 0,
  ...patch,
});
const parts = [
  { id: "structure_lantern_bridge", kind: "structure", name: "Lantern bridge", about: "A rope bridge strung with lanterns.", cost: 400, district: "signpost", options: [] },
  { id: "style_stall", kind: "district_style", name: "The stall style", about: "How the stall is dressed.", cost: 350, district: "stall", options: ["mossy", "lantern", "blossom", "crystal"] },
  { id: "banner", kind: "banner", name: "Banner", about: "A banner across the trunk.", cost: 200, district: null, options: [] },
];
const openState = (patch: Record<string, unknown> = {}) => ({
  enabled: true,
  stage: "elder",
  quests: [quest()],
  available: parts,
  canPropose: { ok: true },
  wallet: 120,
  isAdmin: false,
  settings: { proposers: "level", bannerModeration: false },
  ...patch,
});

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  for (const f of [contribute, propose, approve, withdraw, updateSettings]) f.mockReset();
});

const viewer = { member: { _id: "m_alex", name: "Alex" }, workspace: { timezone: "Europe/Berlin" } } as unknown as ReadyViewer;
function render(node = <Crew />) {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter initialEntries={["/crew"]}>
        <ViewerContext.Provider value={viewer}>
          <div data-window-body className="@container pixel-frame">
            {node}
          </div>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
  expect(windowPageProblems(host)).toEqual([]);
  return host;
}
const text = () => document.body.textContent ?? "";
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);
const click = (el: Element | undefined | null) => act(() => (el as HTMLElement).click());
const type = (el: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("open crew quests", () => {
  test("show their progress, who proposed them, and Add coins with 5, 20 and all", async () => {
    open = openState();
    built = [];
    render();
    expect(text()).toContain("Market awnings");
    expect(text()).toContain("300 of 500 Hog coins (60 %)");
    expect(text()).toContain("Proposed by Priya Raman");
    expect(document.querySelector("[data-crew-quest] [data-thumb] svg")).not.toBeNull(); // its pixel picture
    click(button("All"));
    expect((document.querySelector("[data-coins-input]") as HTMLInputElement).value).toBe("120");
    click(button("20"));
    contribute.mockResolvedValue({ added: 20, funded: false });
    await act(async () => (document.querySelector("[data-crew-quest] form") as HTMLFormElement).requestSubmit());
    expect(contribute).toHaveBeenCalledWith({ questId: "q1", coins: 20 });
    expect(text()).toContain("You gave 20 Hog coins.");
  });

  test("the contribution that funds it says so; a funded quest says when it's built", async () => {
    open = openState({ wallet: 250 });
    built = [];
    render();
    type(document.querySelector("[data-coins-input]") as HTMLInputElement, "200");
    contribute.mockResolvedValue({ added: 200, funded: true });
    await act(async () => (document.querySelector("[data-crew-quest] form") as HTMLFormElement).requestSubmit());
    expect(contribute).toHaveBeenCalledWith({ questId: "q1", coins: 200 });
    expect(text()).toContain("that funded it. It will be built in 3 days.");
    open = openState({ quests: [quest({ status: "funded", contributed: 500, fundedAt: Date.now(), buildsAt: Date.now() + 2.5 * 86_400_000 })] });
    render();
    expect(text()).toContain("Funded. The crew builds it in 3 days.");
    expect(document.querySelector("[data-coins-input]")).toBeNull();
  });

  test("below level 3 there's no wallet to give from yet", () => {
    open = openState({ wallet: null });
    built = [];
    render();
    expect(text()).toContain("Your Hog coin wallet opens at level 3");
    expect(document.querySelector("[data-coins-input]")).toBeNull();
  });

  test("a banner waiting for approval takes no coins; an admin approves or turns it down", () => {
    open = openState({ isAdmin: true, quests: [quest({ kind: "banner", part: "banner", name: "Banner", text: "Onwards and upwards", awaitingApproval: true })] });
    built = [];
    render();
    expect(text()).toContain("Banner: “Onwards and upwards”");
    expect(text()).toContain("waits for an admin to approve its saying");
    expect(document.querySelector("[data-coins-input]")).toBeNull();
    approve.mockResolvedValue(null);
    click(button("Approve the saying"));
    expect(approve).toHaveBeenCalledWith({ questId: "q1" });
  });
});

describe("proposing", () => {
  test("the catalogue shows each part with its picture and cost, the districts' styles as one; a style picks its district and look, then Propose", async () => {
    open = openState({ quests: [], available: [...parts, { ...parts[1], id: "style_pool", name: "The mirror pool style", district: "pool", cost: 350 }] });
    built = [];
    render();
    expect(document.querySelectorAll("[data-part]")).toHaveLength(3);
    expect(document.querySelectorAll("[data-part] [data-thumb] svg")).toHaveLength(3);
    click(document.querySelector('[data-part="district_style"]'));
    expect([...(document.querySelector("[data-style-district]") as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["The stall (350 Hog coins)", "The mirror pool (350 Hog coins)"]);
    expect(document.querySelectorAll("[data-option]")).toHaveLength(4);
    click(document.querySelector('[data-option="crystal"]'));
    propose.mockResolvedValue("q2");
    await act(async () => button("Propose it for 350 Hog coins")!.click());
    expect(propose).toHaveBeenCalledWith({ partId: "style_stall", option: "crystal" });
  });

  test("a banner needs its saying", async () => {
    open = openState({ quests: [] });
    built = [];
    render();
    click(document.querySelector('[data-part="banner"]'));
    const go = () => button("Propose it for 200 Hog coins")!;
    expect(go().disabled).toBe(true);
    type(document.querySelector("[data-banner-text]") as HTMLInputElement, "Thanks make the tree grow");
    propose.mockResolvedValue("q3");
    await act(async () => go().click());
    expect(propose).toHaveBeenCalledWith({ partId: "banner", text: "Thanks make the tree grow" });
  });

  test("who may not propose sees why, and the catalogue stays to look at", () => {
    open = openState({ canPropose: { ok: false, why: "From level 8 you can propose crew quests. Until then, give to the crew's." } });
    built = [];
    render();
    expect(text()).toContain("From level 8 you can propose crew quests");
    expect((document.querySelector('[data-part="banner"]') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the plaque", () => {
  test("lists what the crew built with everyone who gave", () => {
    open = openState({ quests: [] });
    built = [{ _id: "q0", part: "structure_bell", name: "The bell", option: null, text: null, builtAt: Date.now() - 5 * 86_400_000, proposedBy: "Lena Hoffmann", contributed: 300, contributors: ["Lena Hoffmann", "a former teammate", "Alex"] }];
    render();
    expect(document.querySelector('[data-plaque-line="structure_bell"]')?.textContent).toContain("Lena Hoffmann, a former teammate, Alex");
    expect(text()).toContain("Proposed by Lena Hoffmann");
  });

  test("before the crew's plaque opens, the window says when it will", () => {
    open = openState({ enabled: false, quests: [], available: [] });
    built = [];
    render();
    expect(text()).toContain("Crew quests begin when the tree is a great tree");
  });
});

describe("the notice board and the gatehouse", () => {
  test("the notice board pins the open quests' progress", () => {
    open = openState();
    render(<CrewNotice />);
    expect(text()).toContain("The crew is building");
    expect(text()).toContain("300 of 500 Hog coins");
    open = openState({ quests: [] });
    render(<CrewNotice />);
    expect(document.querySelector("[data-crew-notice]")).toBeNull();
  });

  test("the gatehouse sets who proposes and banner moderation, read-only in the demo", () => {
    open = openState();
    updateSettings.mockResolvedValue(null);
    render(<CrewSettings isDemo={false} />);
    click([...document.querySelectorAll("[role=tab], button")].find((b) => b.textContent?.trim() === "Admins only"));
    expect(updateSettings).toHaveBeenCalledWith({ proposers: "admins", bannerModeration: false });
    click(document.querySelector('[role="switch"]'));
    expect(updateSettings).toHaveBeenLastCalledWith({ proposers: "level", bannerModeration: true });
    render(<CrewSettings isDemo />);
    expect((document.querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
