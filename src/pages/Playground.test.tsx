// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { InWindow, windowPageProblems } from "@/testing/windowPage";
import { ViewerContext, type ReadyViewer } from "@/lib/viewer";

/**
 * The sandbox (#133): a Slack terminal standing in the sand that runs the real kudos engine. You
 * post in #general, the bot reacts and replies, and its DMs pile up beside it as envelopes.
 */

const teammates = [
  { name: "Priya Raman", slackUserId: "UDEMOPRIYA", title: "Engineer" },
  { name: "Jonas Weber", slackUserId: "UDEMOJONAS", title: "Designer" },
];
let queries: Record<string, unknown>;
let sprees = false;
const calls: Record<string, ReturnType<typeof vi.fn>> = {};
const replies: Record<string, unknown> = {};
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (fn: never) => queries[getFunctionName(fn)],
    useMutation: (fn: never) => {
      const name = getFunctionName(fn);
      calls[name] ??= vi.fn(async () => replies[name]);
      return calls[name];
    },
  };
});

const { Playground } = await import("./Playground");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const viewer = (isAdmin = false) =>
  ({
    workspaces: [],
    member: { _id: "m1", name: "Alex Rivera", slackUserId: "UDEMOALEX", isAdmin, gameHidden: false },
    workspace: { name: "Lumen Labs", isDemo: true, timezone: "Europe/Berlin", emojiGlyph: "🌮", emojiName: "taco", spreesEnabled: sprees, gameEnabled: true },
  }) as unknown as ReadyViewer;

const dm = (over: Record<string, unknown>) => ({
  _id: crypto.randomUUID(),
  to: "Priya Raman",
  toMe: false,
  category: "receiver_success",
  rarity: "rare",
  text: "Priya, a taco landed on your desk.",
  isNewDiscovery: false,
  ...over,
});

let root: Root | undefined;
let host: HTMLElement;
beforeEach(() => {
  queries = {
    "demo:teammates": teammates,
    "me:today": { remaining: 3, limit: 5, discovered: 12, total: 72 },
    "cosmetics:mine": { emoji: [], superKudos: null },
  };
  sprees = false;
  for (const k of Object.keys(calls)) delete calls[k];
  for (const k of Object.keys(replies)) delete replies[k];
});
afterEach(() => act(() => root?.unmount()));

function render(admin = false) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <MemoryRouter>
        <ViewerContext.Provider value={viewer(admin)}>
          <InWindow>
            <Playground />
          </InWindow>
        </ViewerContext.Provider>
      </MemoryRouter>,
    ),
  );
}
const button = (name: string | RegExp) =>
  [...host.querySelectorAll("button")].find((b) => {
    const label = b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "";
    return typeof name === "string" ? label === name || b.textContent?.trim() === name : name.test(label);
  });
const click = async (name: string | RegExp) => {
  const b = button(name);
  if (!b) throw new Error(`no button ${name}`);
  await act(async () => b.click());
};

test("the sandbox sits in its window: laid out by the window, plain copy round the Slack mock, nothing sideways", () => {
  render();
  expect(windowPageProblems(host)).toEqual([]);
});

test("the Slack terminal stands in the sand in a pixel frame, with #general and the kudos left today", () => {
  render();
  const terminal = host.querySelector("[data-slack-terminal]")!;
  expect(terminal.closest(".pixel-frame, [data-sand]")).not.toBeNull();
  expect(terminal.textContent).toContain("general");
  expect(terminal.querySelector("[aria-label='3 of 5 kudos left today']")).not.toBeNull();
  expect(terminal.querySelector("textarea[aria-label=Message]")).not.toBeNull();
});

test("giving a kudos runs the engine: the bot reacts on your message, replies to you, and DMs the receivers as envelopes", async () => {
  replies["demo:simulateMessage"] = {
    status: "given",
    attempt: { outcome: "given", reaction: "taco", guidance: null, messageTs: "1.1" },
    messages: [
      dm({ to: "Alex Rivera", toMe: true, category: "giver_success", rarity: "common", text: "Delivered! 1 taco for Priya.", earnings: "+20 XP" }),
      dm({ text: "Priya, a taco landed on your desk.", isNewDiscovery: true }),
    ],
  };
  render();
  expect(host.querySelectorAll("[data-envelope]")).toHaveLength(0);
  await click("One for Lena");
  await click("Send");
  expect(calls["demo:simulateMessage"]).toHaveBeenCalledWith({ text: expect.stringContaining(":taco: thanks for organising the offsite!"), channelName: "general" });
  expect(button(/^Kudos bot reacted: Kudos given/)).toBeUndefined(); // a reaction is a label, not a button
  expect(host.querySelector("[aria-label='Kudos bot reacted: Kudos given']")).not.toBeNull();
  const terminal = host.querySelector("[data-slack-terminal]")!;
  expect(terminal.textContent).toContain("Only visible to you");
  expect(terminal.textContent).toContain("Delivered! 1 taco for Priya.");
  expect(terminal.textContent).toContain("+20 XP");
  const envelopes = [...host.querySelectorAll("[data-envelope]")];
  expect(envelopes).toHaveLength(1);
  expect(envelopes[0].textContent).toContain("To Priya Raman");
  expect(envelopes[0].textContent).toContain("Priya, a taco landed on your desk.");
  expect(envelopes[0].textContent).toContain("Rare");
  expect(envelopes[0].textContent).toContain("New discovery");
});

test("a failed kudos can be fixed by editing it, like in Slack", async () => {
  replies["demo:simulateMessage"] = { status: "limit", attempt: { outcome: "limit", guidance: "You have 3 left today.", messageTs: "1.2" }, messages: [] };
  replies["demo:simulateEdit"] = { status: "given", attempt: { outcome: "given", reaction: "taco", guidance: null, messageTs: "1.2" }, messages: [] };
  render();
  await click("Over the limit");
  await click("Send");
  expect(host.querySelector(`[aria-label="Kudos bot reacted: Over today's allowance, nothing was sent"]`)).not.toBeNull();
  await click("Edit");
  const edit = host.querySelector<HTMLTextAreaElement>("textarea[aria-label='Edit message']")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(edit, "@Samir Haddad 🌮 hero of the week");
    edit.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save");
  expect(calls["demo:simulateEdit"]).toHaveBeenCalledWith(expect.objectContaining({ messageTs: "1.2", text: "@Samir Haddad :taco: hero of the week", channelName: "general" }));
  expect(host.querySelector("[aria-label='Kudos bot reacted: Kudos given']")).not.toBeNull();
});

test("reacting to a teammate's post and /kudos me both answer as envelopes", async () => {
  replies["demo:simulateReaction"] = { status: "given", messages: [dm({ text: "Thanks for the react." })] };
  replies["demo:simulateAllowanceCheck"] = { messages: [dm({ to: "Alex Rivera", toMe: true, category: "allowance_status", rarity: "common", text: "You have 3 left today." })] };
  render();
  await click(/^React to Priya Raman's message/);
  expect(calls["demo:simulateReaction"]).toHaveBeenCalledWith(expect.objectContaining({ authorSlackUserId: "UDEMOPRIYA" }));
  await click("/kudos me");
  const envelopes = [...host.querySelectorAll("[data-envelope]")].map((e) => e.textContent);
  expect(envelopes[0]).toContain("You have 3 left today.");
  expect(envelopes[0]).toContain("To you");
  expect(envelopes[1]).toContain("Thanks for the react.");
});

test("the demo controls stand as small signs: refill your kudos and hand back what you bought", async () => {
  render();
  const signs = host.querySelector("[data-demo-signs]")!;
  expect([...signs.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual(["Refill my kudos", "Hand back what I bought"]);
  await click("Refill my kudos");
  expect(calls["demo:refillAllowance"]).toHaveBeenCalled();
  await click("Hand back what I bought");
  expect(calls["demo:handBackRewards"]).toHaveBeenCalled();
});

test("an admin can also reset the demo from the sandbox, after saying yes", async () => {
  render(true);
  await click("Reset the demo");
  expect(calls["demo:resetDemo"]).not.toHaveBeenCalled();
  await click("Yes, reset everything");
  expect(calls["demo:resetDemo"]).toHaveBeenCalled();
});

test("review: with sprees on, refilling your kudos opens the teammate's spree again; with all your kudos it can't be pressed", async () => {
  sprees = true;
  render();
  expect(calls["demo:openSpree"]).toHaveBeenCalledTimes(1);
  await click("Refill my kudos");
  expect(calls["demo:refillAllowance"]).toHaveBeenCalled();
  expect(calls["demo:openSpree"]).toHaveBeenCalledTimes(2);
  act(() => root?.unmount());
  queries["me:today"] = { remaining: 5, limit: 5, discovered: 12, total: 72 };
  render();
  expect(button("Refill my kudos")?.disabled).toBe(true);
});

test("review: joining the teammate's spree from its reaction runs the join and shows the tier's reply in the thread", async () => {
  queries["demo:spreePost"] = { attemptId: "a1", author: "Freya Lindqvist", text: "@Priya thanks", at: 0, joiners: 4, tier: 0, next: 5, status: "open", joined: false, prompt: "Join Freya's kudos?" };
  replies["demo:simulateSpreeJoin"] = { text: "You joined.", thread: "A spree of 5!", messages: [] };
  render();
  await click(/^Kudos bot reacted: Spree 4\/5/);
  await click("Join");
  expect(calls["demo:simulateSpreeJoin"]).toHaveBeenCalledWith({ attemptId: "a1" });
  expect(host.querySelector("[data-slack-terminal]")?.textContent).toContain("A spree of 5!");
});

test("review: a failing demo sign says so instead of failing silently", async () => {
  render();
  calls["demo:handBackRewards"].mockRejectedValueOnce(new Error("offline"));
  await click("Hand back what I bought");
  expect(host.querySelector("[data-demo-signs] [role=alert]")?.textContent).toContain("didn't go through");
});

test("review: after an admin resets the demo, the sandbox says it's on its way", async () => {
  render(true);
  await click("Reset the demo");
  await click("Yes, reset everything");
  expect(host.querySelector("[data-demo-signs]")?.textContent).toContain("The demo is resetting. Reload the page in a minute.");
});

test("review: the hint lives in a status region that is always there, so it's announced", async () => {
  replies["demo:simulateMessage"] = { status: "no_kudos", attempt: null, messages: [] };
  render();
  const region = host.querySelector("[data-hint][role=status]");
  expect(region).not.toBeNull();
  await click("Forget the mention");
  await click("Send");
  expect(host.querySelector("[data-hint][role=status]")).toBe(region);
  expect(region?.textContent).toContain("No kudos in that one.");
});

test("review: on a narrow window the DMs stack under the terminal, so the terminal says when they arrive", async () => {
  replies["demo:simulateAllowanceCheck"] = { messages: [dm({ text: "one" }), dm({ text: "two" })] };
  render();
  await click("/kudos me");
  expect(host.querySelector("[data-new-dms]")?.textContent).toContain("2 new DMs below");
});

test("review: the envelope names who gets the DM in plain words", async () => {
  replies["demo:simulateAllowanceCheck"] = { messages: [dm({ to: "Lena Hoffmann" })] };
  render();
  await click("/kudos me");
  expect(host.querySelector("[data-envelope]")?.textContent).toContain("Lena gets this DM");
});
