import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { skillTreeFixtures } from "./skillTreeFixtures";
import { shellFixtures, type BuyAnswer, type MemberProfile, type MySkillTree, type Purchase, type ShellState } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

const withTheTree = shellFixtures.memberWithEveryFeatureOpen;

const anotherMember: MemberProfile = { ...withTheTree, name: "Alex Other", features: withTheTree.features!.map((card) => ({ ...card, seen: `other-${card.seen}` })) };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/skills");
});

function answerLater() {
  let settle!: (answer: BuyAnswer) => void;
  let fail!: (reason: Error) => void;
  const answer = new Promise<BuyAnswer>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { answer, settle: (value: BuyAnswer) => act(async () => settle(value)), fail: () => act(async () => fail(new Error("socket closed"))) };
}

function main() {
  return screen.getByRole("main");
}

function nodeOf(name: string) {
  return within(within(main()).getByRole("region", { name: "Perk tree" })).getByRole("button", { name: new RegExp(`^${name}\\.`) });
}

function details() {
  return within(main()).getByRole("region", { name: "Perk details" });
}

function detailsHeading() {
  return within(details()).getByRole("heading", { level: 2 });
}

function buyButton() {
  return within(details()).getByRole("button", { name: /^Buy/ });
}

function announcement() {
  return within(details()).getByRole("status");
}

function shownLinesIn(region: HTMLElement) {
  return [...region.querySelectorAll("p")].filter((line) => line.closest("[role=status]") === null).map((line) => line.textContent);
}

function theTree(answer: MySkillTree) {
  let shown = answer;
  return {
    read: (asking: boolean) => (asking ? shown : undefined),
    becomes: (next: MySkillTree) => {
      shown = next;
    },
  };
}

function buyWith(buyPerk: (purchase: Purchase) => Promise<BuyAnswer>, answer: MySkillTree = skillTreeFixtures.withPoints, member: ShellState = withTheTree) {
  preferWideScreen();
  const tree = theTree(answer);
  const spy = vi.fn(buyPerk);
  const view = renderApp(member, undefined, { buyPerk: spy }, undefined, undefined, tree.read);
  const showTree = (next: MySkillTree, visitor: ShellState = member) => {
    tree.becomes(next);
    view.showVisitor(visitor);
  };
  const purchases = () => spy.mock.calls.map(([purchase]) => purchase);
  const requests = () => purchases().map(({ request }) => request);
  return { ...view, buyPerk: spy, showTree, purchases, requests };
}

describe("WS87: an available perk's details hold one primary Buy button", () => {
  it("reads Buy for 1 skill point under the line a spent skill point never comes back, as the page's one primary action", () => {
    buyWith(async () => ({ kind: "bought" }));
    const line = within(details()).getByText("A spent skill point never comes back.");
    expect(buyButton()).toHaveAccessibleName("Buy for 1 skill point");
    expect(line.compareDocumentPosition(buyButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main().querySelectorAll(".quill-button--variant-primary")).toHaveLength(1);
    expect(buyButton()).toHaveClass("quill-button--variant-primary");
    expect(within(details()).queryByRole("link")).toBeNull();
    expect(details()).not.toHaveTextContent("Buy it in Slack's App Home.");
  });

  it("reads Buy for {n} skill points for a larger cost", () => {
    buyWith(async () => ({ kind: "bought" }), skillTreeFixtures.costlyPerk);
    expect(buyButton()).toHaveAccessibleName("Buy for 2 skill points");
  });

  it("sends buyPerk for the selected perk with a browser request at once, with no confirmation dialog", async () => {
    const { user, buyPerk } = buyWith(async () => ({ kind: "refused", reason: null }));
    await user.click(nodeOf("Circle"));
    await user.click(buyButton());
    expect(buyPerk).toHaveBeenCalledExactlyOnceWith({ perk: "circle", request: expect.stringMatching(uuid) });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("reads Buying…, disabled and still, until the answer, and sends once however often it is pressed", async () => {
    const pending = answerLater();
    const { user, buyPerk } = buyWith(() => pending.answer);
    await user.click(buyButton());
    expect(buyButton()).toHaveAccessibleName("Buying…");
    expect(buyButton()).toHaveAttribute("aria-disabled", "true");
    expect(buyButton()).toHaveFocus();
    expect(details().querySelector("[class*='animate']")).toBeNull();
    await user.click(buyButton());
    expect(buyPerk).toHaveBeenCalledTimes(1);
    await pending.settle({ kind: "refused", reason: "points" });
    expect(buyButton()).toHaveAccessibleName("Buy for 1 skill point");
    expect(buyButton()).not.toHaveAttribute("aria-disabled");
  });
});

describe("WS87: a bought perk turns owned in place", () => {
  it("shows the perk owned from the read, says You bought {name}. and moves focus to its details heading, with no crate", async () => {
    const pending = answerLater();
    const { user, showTree } = buyWith(() => pending.answer);
    await user.click(buyButton());
    showTree(skillTreeFixtures.sparkOwned, shellFixtures.memberWithOneSkillPoint);
    await pending.settle({ kind: "bought" });
    expect(details()).toHaveTextContent("Owned since 13 Oct 2026");
    expect(nodeOf("Spark")).toHaveAccessibleName("Spark. Owned.");
    expect(announcement()).toHaveTextContent("You bought Spark.");
    expect(detailsHeading()).toHaveTextContent("Spark");
    expect(detailsHeading()).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the perk as the read has it until the read says it is owned", async () => {
    const { user } = buyWith(async () => ({ kind: "bought" }));
    await user.click(buyButton());
    expect(nodeOf("Spark")).toHaveAccessibleName("Spark. Can buy. Costs 1 skill point.");
    expect(announcement()).toHaveTextContent("You bought Spark.");
  });

  it("names the perk the purchase was for and selects it again when the selection moved while it was sent", async () => {
    const pending = answerLater();
    const { user, showTree } = buyWith(() => pending.answer);
    await user.click(buyButton());
    await user.click(nodeOf("Circle"));
    showTree(skillTreeFixtures.sparkOwned, shellFixtures.memberWithOneSkillPoint);
    await pending.settle({ kind: "bought" });
    expect(announcement()).toHaveTextContent("You bought Spark.");
    expect(nodeOf("Spark")).toHaveAttribute("aria-pressed", "true");
    expect(detailsHeading()).toHaveTextContent("Spark");
    expect(detailsHeading()).toHaveFocus();
  });

  it("announces in the drawer on a narrow screen and moves focus to its heading", async () => {
    const tree = theTree(skillTreeFixtures.withPoints);
    const pending = answerLater();
    const { user, showVisitor } = renderApp(withTheTree, undefined, { buyPerk: () => pending.answer }, undefined, undefined, tree.read);
    await user.click(nodeOf("Rhythm"));
    const drawer = await screen.findByRole("dialog", { name: "Rhythm" });
    await user.click(within(drawer).getByRole("button", { name: "Buy for 1 skill point" }));
    await pending.settle({ kind: "bought" });
    tree.becomes(skillTreeFixtures.noPointsLeft);
    showVisitor(shellFixtures.memberWithNoSkillPointsLeft);
    expect(within(drawer).getByRole("status")).toHaveTextContent("You bought Rhythm.");
    expect(within(drawer).getByRole("heading", { name: "Rhythm" })).toHaveFocus();
  });
});

describe("WS87: a refused purchase changes nothing and says why", () => {
  it.each([
    { reason: "owned", perk: "Spark", answer: skillTreeFixtures.withPoints, says: "That couldn't be bought. You already own Spark." },
    { reason: "level", perk: "Spark", answer: skillTreeFixtures.withPoints, says: "That couldn't be bought. Opens at level 5." },
    { reason: "requires", perk: "Rhythm", answer: skillTreeFixtures.upgradeAvailable, says: "That couldn't be bought. Needs Spark first." },
    { reason: "points", perk: "Spark", answer: skillTreeFixtures.withPoints, says: "That couldn't be bought. No skill points to spend." },
  ] as const)("says $says for $reason", async ({ reason, perk, answer, says }) => {
    const { user } = buyWith(async () => ({ kind: "refused", reason }), answer);
    await user.click(nodeOf(perk));
    await user.click(buyButton());
    expect(announcement()).toHaveTextContent(new RegExp(`^${says}$`));
    expect(details()).toHaveTextContent(says);
    expect(buyButton()).toHaveAccessibleName("Buy for 1 skill point");
    expect(nodeOf(perk)).toHaveAccessibleName(`${perk}. Can buy. Costs 1 skill point.`);
  });

  it("keeps saying why in the perk's details when the read already shows it bought elsewhere", async () => {
    const later = answerLater();
    const { user, showTree } = buyWith(() => later.answer);
    await user.click(buyButton());
    showTree(skillTreeFixtures.sparkOwned);
    await later.settle({ kind: "refused", reason: "owned" });
    expect(within(details()).getByText("Owned since 13 Oct 2026")).toBeInTheDocument();
    expect(shownLinesIn(details())).toContain("That couldn't be bought. You already own Spark.");
    expect(announcement()).toHaveTextContent(/^That couldn't be bought\. You already own Spark\.$/);
  });

  it.each([null, "not-open"] as const)("gives no reason for a refusal at the gate (%s)", async (reason) => {
    const { user } = buyWith(async () => ({ kind: "refused", reason }));
    await user.click(buyButton());
    expect(announcement()).toHaveTextContent(/^That couldn't be bought\.$/);
  });

  it("follows its own read to the ready page after a refusal at the gate", async () => {
    const { user, showTree } = buyWith(async () => ({ kind: "refused", reason: null }));
    await user.click(buyButton());
    showTree(skillTreeFixtures.ready, shellFixtures.memberWithTheSkillTreeReady);
    expect(within(main()).getByRole("heading", { name: "Unlocks: Skill tree" })).toBeInTheDocument();
  });
});

describe("WS87 WS11: a denial ends Buying… and the frame follows getMyProfile", () => {
  it("ends Buying…, then shows the denial page once the profile says so", async () => {
    const { user, showVisitor } = buyWith(async () => ({ kind: "signed-out" }));
    await user.click(buyButton());
    expect(buyButton()).toHaveAccessibleName("Buy for 1 skill point");
    showVisitor(shellFixtures.signedOut);
    expect(screen.getByRole("button", { name: "Sign in with Slack" })).toBeInTheDocument();
  });
});

describe("WS87: an error or no answer lets the member try again with the same request", () => {
  it("ends Buying…, says Couldn't reach HedgeHug. Try again. with the button enabled", async () => {
    const pending = answerLater();
    const { user } = buyWith(() => pending.answer);
    await user.click(buyButton());
    await pending.fail();
    expect(announcement()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(details()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    expect(buyButton()).toHaveAccessibleName("Buy for 1 skill point");
    expect(buyButton()).not.toHaveAttribute("aria-disabled");
  });

  it("resends the same pair when Buy is pressed again on the same perk", async () => {
    const { user, buyPerk, purchases } = buyWith(async () => ({ kind: "bought" }));
    buyPerk.mockRejectedValueOnce(new Error("socket closed"));
    await user.click(buyButton());
    await user.click(buyButton());
    const [first, second] = purchases();
    expect(purchases()).toHaveLength(2);
    expect(second).toEqual(first);
    expect(announcement()).toHaveTextContent("You bought Spark.");
  });

  it("resends the same pair after leaving the perk and coming back to it", async () => {
    const { user, buyPerk, purchases } = buyWith(async () => ({ kind: "bought" }));
    buyPerk.mockRejectedValueOnce(new Error("socket closed"));
    await user.click(buyButton());
    await user.click(nodeOf("Circle"));
    await user.click(nodeOf("Spark"));
    await user.click(buyButton());
    const [first, second] = purchases();
    expect(second).toEqual(first);
  });

  it("makes a fresh pair when Buy is pressed on a different perk after an error", async () => {
    const { user, buyPerk, purchases, requests } = buyWith(async () => ({ kind: "bought" }));
    buyPerk.mockRejectedValueOnce(new Error("socket closed"));
    await user.click(buyButton());
    await user.click(nodeOf("Circle"));
    await user.click(buyButton());
    const [first, second] = requests();
    expect(purchases()[1]).toEqual({ perk: "circle", request: expect.stringMatching(uuid) });
    expect(second).not.toBe(first);
  });

  it("makes a fresh pair for the first perk once a different perk replaced it", async () => {
    const { user, buyPerk, requests } = buyWith(async () => ({ kind: "refused", reason: "points" }));
    buyPerk.mockRejectedValueOnce(new Error("socket closed")).mockRejectedValueOnce(new Error("socket closed"));
    await user.click(buyButton());
    await user.click(nodeOf("Circle"));
    await user.click(buyButton());
    await user.click(nodeOf("Spark"));
    await user.click(buyButton());
    expect(new Set(requests()).size).toBe(3);
  });
});

describe("WS87: the pending purchase is dropped", () => {
  it.each<{ answer: BuyAnswer }>([{ answer: { kind: "bought" } }, { answer: { kind: "refused", reason: "points" } }, { answer: { kind: "refused", reason: null } }, { answer: { kind: "not-a-member" } }])(
    "after the definite answer $answer.kind, so the next Buy makes a fresh pair",
    async ({ answer }) => {
      const { user, buyPerk, requests } = buyWith(async () => answer);
      buyPerk.mockRejectedValueOnce(new Error("socket closed"));
      await user.click(buyButton());
      await user.click(buyButton());
      await user.click(buyButton());
      const [first, retry, next] = requests();
      expect(retry).toBe(first);
      expect(next).not.toBe(retry);
    },
  );

  it("on sign-out, so the same member signing back in makes a fresh pair", async () => {
    const { user, buyPerk, showVisitor, requests } = buyWith(async () => ({ kind: "bought" }));
    buyPerk.mockRejectedValueOnce(new Error("socket closed"));
    await user.click(buyButton());
    showVisitor(shellFixtures.signedOut);
    showVisitor(withTheTree);
    await user.click(buyButton());
    const [first, second] = requests();
    expect(second).not.toBe(first);
  });

  it("when another member replaces the one shown without a sign-out", async () => {
    const { user, buyPerk, showVisitor, requests } = buyWith(async () => ({ kind: "bought" }));
    buyPerk.mockRejectedValueOnce(new Error("socket closed"));
    await user.click(buyButton());
    showVisitor(anotherMember);
    await user.click(buyButton());
    const [first, second] = requests();
    expect(second).not.toBe(first);
  });

  it("when another member replaces the one shown while the first purchase is in flight, ignoring its answer", async () => {
    const pending = answerLater();
    const { user, showVisitor } = buyWith(() => pending.answer);
    await user.click(buyButton());
    showVisitor(anotherMember);
    await pending.settle({ kind: "bought" });
    expect(announcement()).toBeEmptyDOMElement();
    expect(buyButton()).toHaveAccessibleName("Buy for 1 skill point");
  });
});
