import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { catalogue } from "../../../convex/hoggies/catalogue";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "../test/systemTheme";
import type { BoardItem } from "../../../convex/website/album";
import type { TurnReply } from "../shell";
import { albumFixtures } from "./albumFixtures";
import type { Album, AlbumHoggies, ForgeReply } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const arrival = 10_000;

const memberWithTheAlbum = shellFixtures.member;

const forgedItem = "forged-asleep";

const forgedCake: ForgeReply = { kind: "forged", item: forgedItem as BoardItem["item"] };

const cakeTurned: TurnReply = { kind: "turned", face: { kind: "hoggie", drop: { hoggie: "cake", name: "Cake", rarity: "uncommon", art: { kind: "hoggie", slug: "cake" }, copy: 1, isNew: true } }, applied: null, page: { kind: "hoggies" }, unlocked: { teamStickers: [], hype: null, milestones: [] }, again: false };

const withNoItems: Album = { ...albumFixtures.midway, board: { items: [], more: false } };

const asleepForged: BoardItem = { item: forgedItem as BoardItem["item"], earnedAt: 0, reason: { kind: "forge", hoggie: "asleep" } };

const withAsleepForged: Album = { ...withNoItems, board: { items: [asleepForged], more: false } };

const asleepCard = "A face-down item forged from Asleep. Turn it over";

const everyUncommonHeld = Object.fromEntries(catalogue.hoggies.filter(({ rarity }) => rarity === "uncommon").map(({ hoggie }) => [hoggie, 1]));

type Forge = (hoggie: string, request: string) => Promise<ForgeReply>;

type Turn = (item: string) => Promise<TurnReply>;

beforeEach(() => {
  fakeSystemTheme(false);
});

function withCopies(answer: AlbumHoggies, copies: Record<string, number>): AlbumHoggies {
  const hoggies = answer.hoggies.map((hoggie) => {
    const count = copies[hoggie.hoggie] ?? hoggie.count;
    return { ...hoggie, count, found: count > 0, spares: Math.max(0, count - 1), firstAt: hoggie.firstAt ?? (count > 0 ? 0 : null) };
  });
  return { ...answer, hoggies };
}

function visit(path: string, answer: AlbumHoggies & { forge?: true }, forgeHoggie: Forge = async () => forgedCake, { turnItem = async () => cakeTurned, album = withNoItems }: { turnItem?: Turn; album?: Album } = {}) {
  window.history.replaceState(null, "", path);
  let shownAlbum = album;
  const view = renderAlbum(memberWithTheAlbum, (asking) => (asking ? shownAlbum : undefined), { hoggies: fixedHoggies(answer), commands: { forgeHoggie, turnItem } });
  const albumAnswers = (next: Album) => {
    shownAlbum = next;
    act(() => view.showVisitor({ ...memberWithTheAlbum }));
  };
  return { ...view, albumAnswers };
}

async function theFaceDownItem(name = asleepCard) {
  return within(await screen.findByRole("group", { name: "Forged" }, { timeout: arrival })).findByRole("button", { name }, { timeout: arrival });
}

function forgeOn(copies: Record<string, number>) {
  return { ...withCopies(hoggiesFixtures.midway, copies), forge: true as const };
}

function goTo(path: string) {
  act(() => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

async function entry() {
  return within(await screen.findByRole("dialog", undefined, { timeout: arrival }));
}

describe("HF8: a found hoggie's entry says what its spares forge into", { timeout: 60_000 }, () => {
  it("four copies offer Forge 3 into an Uncommon, keeping one", async () => {
    visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    const shown = await entry();
    expect(shown.getByRole("button", { name: "Forge 3 into an Uncommon" })).toBeInTheDocument();
    expect(shown.getByText("Keeps one Asleep. Gives an Uncommon you don't have yet.")).toBeInTheDocument();
  });

  it("fewer than four copies say what four would forge into, with no button", async () => {
    visit("/book#hoggies/asleep", forgeOn({ asleep: 3 }));

    const shown = await entry();
    expect(shown.getByText("4 copies forge into an Uncommon you don't have yet.")).toBeInTheDocument();
    expect(shown.queryByRole("button", { name: /^Forge/ })).not.toBeInTheDocument();
  });

  it("with every Uncommon held, four copies still offer Forge, for an Uncommon the member holds", async () => {
    visit("/book#hoggies/asleep", forgeOn({ asleep: 4, ...everyUncommonHeld }));

    const shown = await entry();
    expect(shown.getByRole("button", { name: "Forge 3 into an Uncommon" })).toBeInTheDocument();
    expect(shown.getByText("Keeps one Asleep. Gives an Uncommon. You hold every one already.")).toBeInTheDocument();
  });

  it("with every Uncommon held, fewer than four copies say what four would forge into, with no button", async () => {
    visit("/book#hoggies/asleep", forgeOn({ asleep: 3, ...everyUncommonHeld }));

    const shown = await entry();
    expect(shown.getByText("4 copies forge into an Uncommon.")).toBeInTheDocument();
    expect(shown.queryByRole("button", { name: /^Forge/ })).not.toBeInTheDocument();
  });

  it("a legendary says nothing about forging", async () => {
    visit("/book#hoggies/rocket", forgeOn({ rocket: 5 }));

    const shown = await entry();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Rocket");
    expect(shown.queryByText(/forge/i)).not.toBeInTheDocument();
  });

  it("with hoggie-forge off, the entry is as before", async () => {
    visit("/book#hoggies/asleep", withCopies(hoggiesFixtures.midway, { asleep: 4 }));

    const shown = await entry();
    expect(shown.getByText("Copies").nextSibling).toHaveTextContent("4 copies");
    expect(shown.queryByText(/forge/i)).not.toBeInTheDocument();
  });
});

describe("HF9, HF10: Forge sends forgeHoggie once and fuses the copies into a face-down item the member turns over", { timeout: 60_000 }, () => {
  it("a click sends forgeHoggie once, the copies fuse into a face-down item, and a click on it turns that item over", async () => {
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    const card = await theFaceDownItem();

    expect(actions.forgeHoggie).toHaveBeenCalledExactlyOnceWith("asleep", expect.any(String));
    expect(screen.getByRole("group", { name: "Forged" })).toHaveTextContent("Forged into an Uncommon. Turn it over.");
    expect(actions.turnItem).not.toHaveBeenCalled();
    await user.click(card);

    expect(actions.turnItem).toHaveBeenCalledExactlyOnceWith(forgedItem);
    expect(await screen.findByRole("status", { name: "Turning over" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Forged" })).not.toBeInTheDocument();
  });

  it("with reduced motion the face-down item shows at once, and its turn lands the forged hoggie on the Hoggies page", async () => {
    preferReducedMotion();
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    const forged = await screen.findByRole("group", { name: "Forged" });
    expect(forged).toHaveAttribute("data-phase", "down");
    await user.click(await theFaceDownItem());

    expect(actions.turnItem).toHaveBeenCalledExactlyOnceWith(forgedItem);
    await waitFor(() => expect(window.location.hash).toBe("#hoggies"));
    expect(await screen.findByRole("status", { name: "Turned over" })).toHaveTextContent("Cake: Uncommon hoggie · New");
  });

  it("Escape leaves the forged item face down on the item board, unturned, and keeps the entry open", async () => {
    const { user, actions, albumAnswers } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await theFaceDownItem();
    albumAnswers(withAsleepForged);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("group", { name: "Forged" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Asleep" })).toBeInTheDocument();
    const board = within(await screen.findByRole("dialog", { name: "Your items" }, { timeout: arrival }));
    expect(board.getByRole("button", { name: asleepCard })).toBeInTheDocument();
    expect(board.getByText("Forged")).toBeInTheDocument();
    expect(actions.turnItem).not.toHaveBeenCalled();
  });

  it("while the face-down item waits in the entry the item board stays closed, though it lists the forged item", async () => {
    const { user, albumAnswers } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await theFaceDownItem();
    albumAnswers(withAsleepForged);

    expect(screen.queryByRole("dialog", { name: "Your items" })).not.toBeInTheDocument();
    expect(await theFaceDownItem()).toBeInTheDocument();
  });

  it("while the forge plays, Tab keeps focus on the face-down item and the entry behind it takes no press", async () => {
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 7 }));

    const shown = await entry();
    const forgeButton = shown.getByRole("button", { name: "Forge 3 into an Uncommon" });
    await user.click(forgeButton);
    const card = await theFaceDownItem();
    await waitFor(() => expect(card).toHaveFocus());
    await user.tab();
    await user.tab({ shift: true });

    expect(card).toHaveFocus();
    expect(forgeButton.closest("[inert]")).not.toBeNull();
    expect(shown.getByRole("button", { name: "Close", hidden: true }).closest("[inert]")).not.toBeNull();
    await user.keyboard("{Enter}");
    expect(actions.turnItem).toHaveBeenCalledExactlyOnceWith(forgedItem);
    expect(actions.forgeHoggie).toHaveBeenCalledOnce();
  });

  it("a forged item turned on the item board leaves no face-down item in its entry", async () => {
    preferReducedMotion();
    let answer: (reply: ForgeReply) => void = () => {};
    const { user, actions, albumAnswers } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }), () => new Promise((resolve) => (answer = resolve)));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => answer(forgedCake));
    albumAnswers(withAsleepForged);
    const board = within(await screen.findByRole("dialog", { name: "Your items" }, { timeout: arrival }));
    await user.click(board.getByRole("button", { name: asleepCard }));
    await waitFor(() => expect(actions.turnItem).toHaveBeenCalledExactlyOnceWith(forgedItem));
    albumAnswers(withNoItems);
    goTo("/book#hoggies/asleep");

    expect(await screen.findByRole("dialog", { name: "Asleep" }, { timeout: arrival })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Forged" })).not.toBeInTheDocument();
  });

  it("pressing Forge again before the answer sends nothing more", async () => {
    let answer: (reply: ForgeReply) => void = () => {};
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }), () => new Promise((resolve) => (answer = resolve)));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await user.click(shown.getByRole("button", { name: "Forging…" }));
    await act(async () => answer(forgedCake));

    expect(await theFaceDownItem()).toBeInTheDocument();
    expect(actions.forgeHoggie).toHaveBeenCalledExactlyOnceWith("asleep", expect.any(String));
  });

  it("a refusal says so and keeps Forge to try again", async () => {
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }), async () => ({ kind: "refused" }));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(await shown.findByText("Asleep couldn't be forged. Reload the page to see where it stands.")).toBeInTheDocument();
    expect(shown.getByRole("button", { name: "Forge 3 into an Uncommon" })).toBeInTheDocument();
  });

  it("Forge after an unreachable server sends the same request again, so a forge that landed is never made twice", async () => {
    let calls = 0;
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 7 }), async () => ((calls += 1) === 1 ? Promise.reject(new Error("offline")) : forgedCake));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await shown.findByText("Couldn't reach HedgeHug. Try again.");
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await theFaceDownItem();

    const [first, again] = actions.forgeHoggie.mock.calls;
    expect(again).toEqual(first);
  });

  it("a lost answer keeps its request through a visit to another page, and per hoggie", async () => {
    let calls = 0;
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 7, ball: 4 }), async () => ((calls += 1) <= 2 ? Promise.reject(new Error("offline")) : forgedCake));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await (await entry()).findByText("Couldn't reach HedgeHug. Try again.");
    goTo("/book#hoggies/ball");
    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await (await entry()).findByText("Couldn't reach HedgeHug. Try again.");
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await theFaceDownItem();

    const [first, other, again] = actions.forgeHoggie.mock.calls;
    expect(again, "asleep's request after the visit").toEqual(first);
    expect(other![1], "ball's own request").not.toBe(first![1]);
  });

  it("a forge that landed while its answer was lost keeps Forge to fetch that answer, though one copy is left", async () => {
    let shown = forgeOn({ asleep: 4 });
    let calls = 0;
    const lostAfterLanding = async () => {
      if ((calls += 1) > 1) return forgedCake;
      shown = forgeOn({ asleep: 1, cake: 1 });
      throw new Error("offline");
    };
    window.history.replaceState(null, "", "/book#hoggies/asleep");
    const { user, actions, showVisitor } = renderAlbum(memberWithTheAlbum, (asking) => (asking ? withNoItems : undefined), { hoggies: (asking) => (asking ? shown : undefined), commands: { forgeHoggie: lostAfterLanding } });

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await (await entry()).findByText("Couldn't reach HedgeHug. Try again.");
    act(() => showVisitor({ ...memberWithTheAlbum }));
    const shownAfter = await entry();
    expect(shownAfter.getByText("Couldn't reach HedgeHug. Try again.")).toBeInTheDocument();
    expect(shownAfter.getByText("Copies").nextSibling).toHaveTextContent("one copy");
    await user.click(shownAfter.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(await theFaceDownItem()).toBeInTheDocument();
    const [first, again] = actions.forgeHoggie.mock.calls;
    expect(again).toEqual(first);
  });

  it("a forge that landed while its answer was lost still offers Forge after a visit to another page", async () => {
    let shown = forgeOn({ asleep: 4 });
    let calls = 0;
    const lostAfterLanding = async () => {
      if ((calls += 1) > 1) return forgedCake;
      shown = forgeOn({ asleep: 1, cake: 1 });
      throw new Error("offline");
    };
    window.history.replaceState(null, "", "/book#hoggies/asleep");
    const { user, actions, showVisitor } = renderAlbum(memberWithTheAlbum, (asking) => (asking ? withNoItems : undefined), { hoggies: (asking) => (asking ? shown : undefined), commands: { forgeHoggie: lostAfterLanding } });

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await (await entry()).findByText("Couldn't reach HedgeHug. Try again.");
    act(() => showVisitor({ ...memberWithTheAlbum }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    const back = await entry();
    expect(back.getByText("Couldn't reach HedgeHug. Try again.")).toBeInTheDocument();
    await user.click(back.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(await theFaceDownItem()).toBeInTheDocument();
    const [first, again] = actions.forgeHoggie.mock.calls;
    expect(again).toEqual(first);
  });

  it("a forge still unanswered after a visit to another page shows Forging… on return, then its face-down item", async () => {
    let answer: (reply: ForgeReply) => void = () => {};
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }), () => new Promise((resolve) => (answer = resolve)));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    const back = await entry();
    expect(back.getByRole("button", { name: "Forging…" })).toBeInTheDocument();
    expect(back.queryByText("Couldn't reach HedgeHug. Try again.")).not.toBeInTheDocument();
    act(() => answer(forgedCake));

    expect(await theFaceDownItem()).toBeInTheDocument();
    expect(actions.forgeHoggie).toHaveBeenCalledOnce();
  });

  it("a forge answered while the member was away shows its face-down item on its own entry, not on another hoggie's", async () => {
    let answer: (reply: ForgeReply) => void = () => {};
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4, ball: 1 }), () => new Promise((resolve) => (answer = resolve)));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => answer(forgedCake));
    goTo("/book#hoggies/ball");
    await entry();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Ball");
    expect(screen.queryByRole("group", { name: "Forged" }), "no face-down item on Ball's entry").not.toBeInTheDocument();
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    expect(await theFaceDownItem()).toBeInTheDocument();
  });

  it("two forges answered while the member was away each keep their face-down item for their own entry", async () => {
    const forgedBall: ForgeReply = { kind: "forged", item: "forged-ball" as BoardItem["item"] };
    const answers: Array<(reply: ForgeReply) => void> = [];
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4, ball: 4 }), () => new Promise((resolve) => answers.push(resolve)));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => answers[0]!(forgedCake));
    goTo("/book#hoggies/ball");
    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await act(async () => answers[1]!(forgedBall));
    expect(await theFaceDownItem("A face-down item forged from Ball. Turn it over"), "Ball's own face-down item").toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Forged" })).not.toBeInTheDocument());

    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    expect(await theFaceDownItem(), "Asleep's face-down item, kept").toBeInTheDocument();
  });

  it("each answered forge sends a new request", async () => {
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 7 }), async () => ({ kind: "refused" }));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await shown.findByText("Asleep couldn't be forged. Reload the page to see where it stands.");
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    await waitFor(() => expect(actions.forgeHoggie).toHaveBeenCalledTimes(2));
    const [first, next] = actions.forgeHoggie.mock.calls;
    expect(next![1]).not.toBe(first![1]);
  });

  it("an unreachable server says to try again and keeps Forge", async () => {
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }), async () => Promise.reject(new Error("offline")));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(await shown.findByText("Couldn't reach HedgeHug. Try again.")).toBeInTheDocument();
    expect(shown.getByRole("button", { name: "Forge 3 into an Uncommon" })).toBeInTheDocument();
  });
});
