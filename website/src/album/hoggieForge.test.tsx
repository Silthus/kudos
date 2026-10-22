import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { catalogue } from "../../../convex/hoggies/catalogue";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion } from "../test/systemTheme";
import { albumFixtures, fixedAlbum } from "./albumFixtures";
import type { AlbumHoggies, ForgeReply } from "./answer";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";

const arrival = 10_000;

const memberWithTheAlbum = shellFixtures.member;

const forgedCake: ForgeReply = { kind: "forged", drop: { hoggie: "cake", name: "Cake", rarity: "uncommon", art: { kind: "hoggie", slug: "cake" }, copy: 1, isNew: true } };

const everyUncommon = new Set(catalogue.hoggies.filter(({ rarity }) => rarity === "uncommon").map(({ hoggie }) => hoggie));

type Forge = (hoggie: string, request: string) => Promise<ForgeReply>;

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

function visit(path: string, answer: AlbumHoggies & { forge?: true }, forgeHoggie: Forge = async () => forgedCake) {
  window.history.replaceState(null, "", path);
  return renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { hoggies: fixedHoggies(answer), commands: { forgeHoggie } });
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

  it("with every Uncommon held, four copies say so, with no button", async () => {
    visit("/book#hoggies/asleep", forgeOn({ asleep: 4, ...Object.fromEntries([...everyUncommon].map((hoggie) => [hoggie, 1])) }));

    const shown = await entry();
    expect(shown.getByText("You hold every Uncommon.")).toBeInTheDocument();
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

describe("HF9, HF10: Forge sends forgeHoggie once and plays the forged hoggie's reveal", { timeout: 60_000 }, () => {
  it("a click sends forgeHoggie once, names the forged hoggie, and a click on the reveal steps to its entry", async () => {
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(actions.forgeHoggie).toHaveBeenCalledExactlyOnceWith("asleep", expect.any(String));
    const reveal = await screen.findByRole("status", { name: "Forged" });
    expect(reveal).toHaveTextContent("Forged: Cake · Uncommon · New");
    await user.click(reveal);

    await waitFor(() => expect(window.location.hash).toBe("#hoggies/cake"));
    expect(screen.queryByRole("status", { name: "Forged" })).not.toBeInTheDocument();
  });

  it("Escape ends the reveal and steps to the forged hoggie, keeping the entry open", async () => {
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await screen.findByRole("status", { name: "Forged" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(window.location.hash).toBe("#hoggies/cake"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("while the reveal plays, Tab keeps focus on it and the entry behind it takes no press", async () => {
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 7 }));

    const shown = await entry();
    const forgeButton = shown.getByRole("button", { name: "Forge 3 into an Uncommon" });
    await user.click(forgeButton);
    const reveal = await screen.findByRole("status", { name: "Forged" });
    await user.tab();
    await user.tab({ shift: true });

    expect(reveal).toHaveFocus();
    expect(forgeButton.closest("[inert]")).not.toBeNull();
    expect(shown.getByRole("button", { name: "Close", hidden: true }).closest("[inert]")).not.toBeNull();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(window.location.hash).toBe("#hoggies/cake"));
    expect(actions.forgeHoggie).toHaveBeenCalledOnce();
  });

  it("with reduced motion the reveal shows the forged hoggie at once, with no movement", async () => {
    preferReducedMotion();
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    const reveal = await screen.findByRole("status", { name: "Forged" });
    expect(reveal).toHaveAttribute("data-phase", "shown");
    expect(reveal).toHaveTextContent("Forged: Cake · Uncommon · New");
  });

  it("pressing Forge again before the answer sends nothing more", async () => {
    let answer: (reply: ForgeReply) => void = () => {};
    const { user, actions } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4 }), () => new Promise((resolve) => (answer = resolve)));

    const shown = await entry();
    await user.click(shown.getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await user.click(shown.getByRole("button", { name: "Forging…" }));
    act(() => answer(forgedCake));

    expect(await screen.findByRole("status", { name: "Forged" })).toBeInTheDocument();
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
    await screen.findByRole("status", { name: "Forged" });

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
    await screen.findByRole("status", { name: "Forged" });

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
    const { user, actions, showVisitor } = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { hoggies: (asking) => (asking ? shown : undefined), commands: { forgeHoggie: lostAfterLanding } });

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await (await entry()).findByText("Couldn't reach HedgeHug. Try again.");
    act(() => showVisitor({ ...memberWithTheAlbum }));
    const shownAfter = await entry();
    expect(shownAfter.getByText("Couldn't reach HedgeHug. Try again.")).toBeInTheDocument();
    expect(shownAfter.getByText("Copies").nextSibling).toHaveTextContent("one copy");
    await user.click(shownAfter.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(await screen.findByRole("status", { name: "Forged" })).toHaveTextContent("Forged: Cake · Uncommon · New");
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
    const { user, actions, showVisitor } = renderAlbum(memberWithTheAlbum, fixedAlbum(albumFixtures.midway), { hoggies: (asking) => (asking ? shown : undefined), commands: { forgeHoggie: lostAfterLanding } });

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await (await entry()).findByText("Couldn't reach HedgeHug. Try again.");
    act(() => showVisitor({ ...memberWithTheAlbum }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    const back = await entry();
    expect(back.getByText("Couldn't reach HedgeHug. Try again.")).toBeInTheDocument();
    await user.click(back.getByRole("button", { name: "Forge 3 into an Uncommon" }));

    expect(await screen.findByRole("status", { name: "Forged" })).toHaveTextContent("Forged: Cake · Uncommon · New");
    const [first, again] = actions.forgeHoggie.mock.calls;
    expect(again).toEqual(first);
  });

  it("a forge still unanswered after a visit to another page shows Forging… on return, then its reveal", async () => {
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

    expect(await screen.findByRole("status", { name: "Forged" })).toHaveTextContent("Forged: Cake · Uncommon · New");
    expect(actions.forgeHoggie).toHaveBeenCalledOnce();
  });

  it("a forge answered while the member was away reveals on its own entry, not on another hoggie's", async () => {
    let answer: (reply: ForgeReply) => void = () => {};
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4, ball: 1 }), () => new Promise((resolve) => (answer = resolve)));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => answer(forgedCake));
    goTo("/book#hoggies/ball");
    await entry();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Ball");
    expect(screen.queryByRole("status", { name: "Forged" }), "no reveal on Ball's entry").not.toBeInTheDocument();
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    expect(await screen.findByRole("status", { name: "Forged" })).toHaveTextContent("Forged: Cake · Uncommon · New");
  });

  it("two forges answered while the member was away each keep their reveal for their own entry", async () => {
    const forgedDisco: ForgeReply = { kind: "forged", drop: { hoggie: "basketball-coach", name: "Basketball Coach", rarity: "uncommon", art: { kind: "hoggie", slug: "basketball-coach" }, copy: 1, isNew: true } };
    const answers: Array<(reply: ForgeReply) => void> = [];
    const { user } = visit("/book#hoggies/asleep", forgeOn({ asleep: 4, ball: 4 }), () => new Promise((resolve) => answers.push(resolve)));

    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => answers[0]!(forgedCake));
    goTo("/book#hoggies/ball");
    await user.click((await entry()).getByRole("button", { name: "Forge 3 into an Uncommon" }));
    await act(async () => answers[1]!(forgedDisco));
    expect(await screen.findByRole("status", { name: "Forged" }), "Ball's own reveal").toHaveTextContent("Forged: Basketball Coach · Uncommon · New");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("status", { name: "Forged" })).not.toBeInTheDocument());

    goTo("/book#leaderboard");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    goTo("/book#hoggies/asleep");
    expect(await screen.findByRole("status", { name: "Forged" }), "Asleep's reveal, kept").toHaveTextContent("Forged: Cake · Uncommon · New");
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
