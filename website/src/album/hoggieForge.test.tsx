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
