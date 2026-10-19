import { act, screen, waitFor, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type MemberProfile } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferReducedMotion, preferWideScreen } from "../test/systemTheme";
import { albumFixtures } from "./albumFixtures";
import type { Album, AlbumRead, PackOpenReply, PutAllInReply, PutInReply, TrayItem } from "./answer";
import { albumWithLanded } from "./tray";
import { putInFlightMs, putInGapMs } from "./usePuttingIn";

const memberWithTheAlbum: MemberProfile = { ...shellFixtures.memberWithEveryFeatureOpen, album: true };

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
});

afterEach(() => {
  vi.useRealTimers();
});

function anAlbumThatAnswers(first: Album) {
  let answer = first;
  const listeners = new Set<() => void>();
  const read: AlbumRead = (asking) => {
    const shown = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => answer,
    );
    return asking ? shown : undefined;
  };
  const answerNext = (next: Album) => {
    answer = next;
    act(() => listeners.forEach((listener) => listener()));
  };
  return { read, answerNext, now: () => answer };
}

function placedIn(album: Album, placed: TrayItem[]): Album {
  const gone = new Set(placed.map(({ item }) => item));
  const arriving = new Set(placed.flatMap((item) => (item.kind === "sticker" ? [item.person] : [])));
  return {
    ...album,
    tray: album.tray.filter(({ item }) => !gone.has(item)),
    people: album.people.map((person) => (arriving.has(person.person) ? { ...person, held: true } : person)),
    teams: album.teams.map((team) => {
      const held = Math.min(team.total, team.held + team.people.filter((person) => arriving.has(person) && !album.people.some((listed) => listed.person === person && listed.held)).length);
      return team.state === "progress" ? { ...team, held, state: held === team.total ? "ready" : "progress" } : team;
    }),
  };
}

type Commands = { putIn?: (item: string) => Promise<PutInReply>; putAllIn?: () => Promise<PutAllInReply>; openThoughtfulPack?: (pack: string) => Promise<PackOpenReply> };

function visit(album: Album, commands: Commands, { path = "/" }: { path?: string } = {}) {
  window.history.replaceState(null, "", path);
  const live = anAlbumThatAnswers(album);
  const putIn = vi.fn(async (item: string) => {
    const reply = await (commands.putIn ?? (async () => ({ kind: "refused" }) as const))(item);
    if (reply.kind === "placed") live.answerNext(placedIn(live.now(), [reply.item]));
    return reply;
  });
  const putAllIn = vi.fn(async () => {
    const reply = await (commands.putAllIn ?? (async () => ({ kind: "refused" }) as const))();
    if (reply.kind === "placed") live.answerNext(placedIn(live.now(), reply.items));
    return reply;
  });
  const openThoughtfulPack = vi.fn(async (pack: string) => {
    const reply = await (commands.openThoughtfulPack ?? (async () => ({ kind: "refused" }) as const))(pack);
    if (reply.kind === "opened") live.answerNext({ ...live.now(), packs: live.now().packs.filter((waiting) => waiting.pack !== pack), tray: [...live.now().tray, ...reply.items] });
    return reply;
  });
  const view = renderAlbum(memberWithTheAlbum, live.read, { commands: { putIn, putAllIn, openThoughtfulPack } });
  return { ...view, putIn, putAllIn, openThoughtfulPack, live };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => (resolve = settle));
  return { promise, resolve };
}

async function topBar() {
  const [bar] = await screen.findAllByRole("banner");
  return within(bar!);
}

async function sidebar() {
  return within(await screen.findByRole("navigation", { name: "Album" }));
}

async function openTheTray(user: ReturnType<typeof visit>["user"]) {
  await user.click((await topBar()).getByRole("button", { name: /^Tray/ }));
  return within(await screen.findByRole("region", { name: "Tray" }));
}

const juno: TrayItem = { item: "tray-juno", kind: "sticker", person: "juno-park" };

const rook: TrayItem = { item: "tray-rook", kind: "sticker", person: "rook-dale" };

const banana: TrayItem = { item: "tray-banana", kind: "hoggie", hoggie: "banana", rarity: "common", isNew: true };

const coffee: TrayItem = { item: "tray-coffee", kind: "hoggie", hoggie: "coffee-run", rarity: "rare", isNew: false };

const unnamed: TrayItem = { item: "tray-stranger", kind: "sticker", person: "someone-unlisted" };

function withTray(album: Album, tray: TrayItem[]): Album {
  return { ...album, packs: [], tray };
}

const lanternsOfSix: Album = { ...albumFixtures.midway, teams: albumFixtures.midway.teams.map((team) => (team.team === "lanterns" ? { ...team, people: [...team.people, "kai-lumen"], total: 6 } : team)) };

function sixtyItems(): TrayItem[] {
  return Array.from({ length: 60 }, (_, index) => (index % 3 === 0 ? { item: `tray-h${index}`, kind: "hoggie", hoggie: "banana", rarity: "common", isNew: false } : { item: `tray-s${index}`, kind: "sticker", person: `teammate-${index}` }));
}

describe("AL47: the tray panel lists each item with where it goes", () => {
  it("names each sticker's team page and its count after, each hoggie's rarity and whether it is new, with a Put in on each and Put them all in", async () => {
    const { user } = visit(withTray(lanternsOfSix, [juno, banana, coffee]), {});

    const tray = await openTheTray(user);

    const rows = tray.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("Juno Park→ Lanterns · 4/6 → 5/6"), expect.stringContaining("Banana→ Hoggies · Common, new"), expect.stringContaining("Coffee Run→ Hoggies · Rare, a spare")]);
    expect(within(rows[0]!).getByRole("button", { name: "Put Juno Park's card in" })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole("button", { name: "Put Banana in" })).toBeInTheDocument();
    expect(tray.getByRole("button", { name: "Put them all in · 3" })).toBeInTheDocument();
  });

  it("says when a sticker completes its team page, and sends a sticker for someone getAlbum doesn't name to the album", async () => {
    const { user } = visit(withTray(albumFixtures.midway, [juno, unnamed]), {});

    const tray = await openTheTray(user);

    expect(tray.getAllByRole("listitem").map((row) => row.textContent)).toEqual([expect.stringContaining("Juno Park→ Lanterns · completes the page!"), expect.stringContaining("A teammate→ your album")]);
    expect(tray.getByRole("button", { name: "Put your teammate's card in" })).toBeInTheDocument();
  });

  it("names a sticker for someone on no team page from the tray item, with their stored face", async () => {
    const ivo: TrayItem = { item: "tray-ivo", kind: "sticker", person: "ivo-strand", thanked: { name: "Ivo Strand", face: { kind: "slack", image: "https://pictures.example/ivo.png", initials: "IS" } } };
    const { user } = visit(withTray(albumFixtures.midway, [ivo]), {});

    const tray = await openTheTray(user);

    const [row] = tray.getAllByRole("listitem");
    expect(row).toHaveTextContent("Ivo Strand→ your album");
    expect(row!.querySelector(".al-tray-token img")).toHaveAttribute("src", "https://pictures.example/ivo.png");
    expect(tray.getByRole("button", { name: "Put Ivo Strand's card in" })).toBeInTheDocument();
  });

  it("with one item offers Put it in, and with none says how the tray fills", async () => {
    const { user, unmount } = visit(withTray(albumFixtures.midway, [banana]), {});
    expect((await openTheTray(user)).getByRole("button", { name: "Put it in" })).toBeInTheDocument();
    unmount();

    const empty = visit(withTray(albumFixtures.midway, []), {});
    const tray = await openTheTray(empty.user);
    expect(tray.getByText("Open a pack and what it holds waits here to be put in.")).toBeInTheDocument();
    expect(tray.queryByRole("button", { name: /^Put/ })).not.toBeInTheDocument();
  });

  it("keeps each face and name in a ph-no-capture block", async () => {
    const { user } = visit(withTray(albumFixtures.midway, [juno, banana]), {});

    await openTheTray(user);

    const panel = screen.getByRole("region", { name: "Tray" });
    expect([...panel.querySelectorAll(".ph-no-capture")].map((block) => block.textContent)).toEqual(expect.arrayContaining(["Juno Park"]));
    expect(panel.querySelector(".ph-no-capture .al-face, .ph-no-capture img, .ph-no-capture [class*='face']")).not.toBeNull();
    expect([...panel.querySelectorAll("[aria-label*='Juno Park']")].filter((labelled) => labelled.closest(".ph-no-capture") === null)).toEqual([]);
  });
});

describe("AL11: Put them all in calls putAllIn until more is false, flying each item in the order the command answers", () => {
  it("puts a tray of 60 in over three answers, each call only once the last page has landed, and the tray empties", async () => {
    preferReducedMotion();
    const tray = sixtyItems();
    const pages = [deferred<PutAllInReply>(), deferred<PutAllInReply>(), deferred<PutAllInReply>()];
    let call = 0;
    const { user, putAllIn } = visit(withTray(albumFixtures.midway, tray), { putAllIn: () => pages[call++]!.promise });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 60" }));

    expect(putAllIn).toHaveBeenCalledTimes(1);
    await act(async () => pages[0]!.resolve({ kind: "placed", items: tray.slice(0, 25), more: true }));
    expect(await (await topBar()).findByRole("button", { name: "Tray, putting in, 35 to go" })).toBeInTheDocument();
    expect(putAllIn).toHaveBeenCalledTimes(2);
    await act(async () => pages[1]!.resolve({ kind: "placed", items: tray.slice(25, 50), more: true }));
    expect(await (await topBar()).findByRole("button", { name: "Tray, putting in, 10 to go" })).toBeInTheDocument();
    expect(putAllIn).toHaveBeenCalledTimes(3);
    await act(async () => pages[2]!.resolve({ kind: "placed", items: tray.slice(50), more: false }));

    expect(await (await topBar()).findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    expect(putAllIn).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("status", { name: "Putting in" })).toHaveTextContent("60 cards put in your album.");
  });

  it("flies each item to its slot in the answer's order, ticking the tray and the team on each landing, and the unlock arrives after the last sticker settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = visit(withTray(albumFixtures.midway, [juno, rook, banana]), { putAllIn: async () => ({ kind: "placed", items: [banana, rook, juno], more: false }) });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 3" }));

    const bar = await topBar();
    const side = await sidebar();
    expect(await bar.findByRole("button", { name: "Tray, putting in, 3 to go" })).toBeInTheDocument();
    expect(document.querySelectorAll(".al-flight").length).toBe(1);
    expect(document.querySelector(".al-flight")).toHaveAttribute("data-to", "hoggies");
    expect(side.getByRole("link", { name: /Lanterns/ })).toHaveTextContent("4 of 5 · 1 to go");

    await act(() => vi.advanceTimersByTimeAsync(putInFlightMs));
    expect(bar.getByRole("button", { name: "Tray, putting in, 2 to go" })).toBeInTheDocument();
    expect(within(side.getByRole("list", { name: "Teams" })).getByRole("link", { name: /Paper Moons/ })).not.toHaveTextContent("Ready");

    await act(() => vi.advanceTimersByTimeAsync(putInGapMs(3)));
    expect(bar.getByRole("button", { name: "Tray, putting in, 1 to go" })).toBeInTheDocument();
    expect(within(side.getByRole("list", { name: "Teams" })).getByRole("link", { name: /Paper Moons/ })).toHaveTextContent("Ready");
    expect(side.getByRole("link", { name: /Lanterns/ })).toHaveTextContent("4 of 5 · 1 to go");

    await act(() => vi.advanceTimersByTimeAsync(putInGapMs(3)));
    expect(side.getByRole("link", { name: /Lanterns/ })).toHaveTextContent("Ready to unlock");
    expect(await bar.findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
  });

  it("each flight heads for its glowing slot: a hoggie to Hoggies, a sticker to its team page, someone unnamed to the album's home", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = visit(withTray(albumFixtures.midway, [juno, unnamed, banana]), { putAllIn: async () => ({ kind: "placed", items: [banana, juno, unnamed], more: false }) });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 3" }));
    await (await topBar()).findByRole("button", { name: "Tray, putting in, 3 to go" });
    await act(() => vi.advanceTimersByTimeAsync(2 * putInGapMs(3)));

    expect([...document.querySelectorAll(".al-flight")].map((flight) => flight.getAttribute("data-to"))).toEqual(["hoggies", "team:lanterns", "home"]);
    expect(document.querySelectorAll("[data-beckon]").length).toBeGreaterThan(0);
  });

  it("Escape lands every flight at once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = visit(withTray(albumFixtures.midway, [juno, rook, banana]), { putAllIn: async () => ({ kind: "placed", items: [banana, rook, juno], more: false }) });
    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 3" }));
    await (await topBar()).findByRole("button", { name: "Tray, putting in, 3 to go" });

    await user.keyboard("{Escape}");

    expect(await (await topBar()).findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    expect(document.querySelectorAll(".al-flight").length).toBe(0);
  });
});

describe("AL11: a put-in sequence follows the tray as it is, and ends with the album", () => {
  it("counts an item opened on another device that a later page answers, so the tray never says none are left while it flies", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let call = 0;
    const { user } = visit(withTray(albumFixtures.midway, [juno]), { putAllIn: async () => (call++ === 0 ? { kind: "placed", items: [juno], more: true } : { kind: "placed", items: [rook], more: false }) });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put it in" }));
    const bar = await topBar();
    await bar.findByRole("button", { name: "Tray, putting in, 1 to go" });
    await act(() => vi.advanceTimersByTimeAsync(putInFlightMs));

    expect(await bar.findByRole("button", { name: "Tray, putting in, 1 to go" })).toBeInTheDocument();
    expect(document.querySelector(".al-flight")).toHaveAttribute("data-to", "team:paper-moons");
    await act(() => vi.advanceTimersByTimeAsync(putInFlightMs));
    expect(await bar.findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
  });

  it("sends no further page once the album has gone, mid-flight or while a page is on its way", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const page = deferred<PutAllInReply>();
    let call = 0;
    const { user, putAllIn, unmount } = visit(withTray(albumFixtures.midway, [juno, rook, banana]), { putAllIn: () => (call++ === 0 ? page.promise : Promise.resolve({ kind: "placed", items: [], more: false })) });
    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 3" }));

    unmount();
    await act(async () => page.resolve({ kind: "placed", items: [banana], more: true }));
    await act(() => vi.advanceTimersByTimeAsync(3 * putInFlightMs));

    expect(putAllIn).toHaveBeenCalledTimes(1);
  });
});

describe("AL19: an unlocked team gaining a person counts them on landing and stays unlocked", () => {
  it("adds the landed person to the held count without changing the team's state", () => {
    const harbour = albumFixtures.midway.teams.find(({ team }) => team === "quiet-harbour")!;
    const grown: Album = { ...albumFixtures.midway, teams: albumFixtures.midway.teams.map((team) => (team === harbour ? { ...team, people: [...team.people, "nova-lark"], total: 3 } : team)), people: [...albumFixtures.midway.people, { person: "nova-lark", name: "Nova Lark", face: { kind: "initials", initials: "NL" }, teams: ["quiet-harbour"], held: false, packedThisWeek: false }] };

    const landed = albumWithLanded(grown, [{ item: "tray-nova", kind: "sticker", person: "nova-lark" }]);

    expect(landed.teams.find(({ team }) => team === "quiet-harbour")).toMatchObject({ held: 3, total: 3, state: "unlocked" });
  });
});

describe("AL47: Put in puts one item in", () => {
  it("sends putIn once for that item, closes the panel onto the tray button, and counts it only on landing", async () => {
    const { user, putIn } = visit(withTray(albumFixtures.midway, [juno, banana]), { putIn: async (item) => ({ kind: "placed", item: item === juno.item ? juno : banana }) });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put Juno Park's card in" }));

    expect(putIn.mock.calls).toEqual([["tray-juno"]]);
    expect(screen.queryByRole("region", { name: "Tray" })).not.toBeInTheDocument();
    const bar = await topBar();
    expect(bar.getByRole("button", { name: /^Tray/ })).toHaveFocus();
    expect(await bar.findByRole("button", { name: "Tray, putting in, 2 to go" })).toBeInTheDocument();
    expect(await bar.findByRole("button", { name: "Tray, 1 to put in" }, { timeout: 3000 })).toBeInTheDocument();
    expect((await sidebar()).getByRole("link", { name: /Lanterns/ })).toHaveTextContent("Ready to unlock");
    expect(screen.getByRole("status", { name: "Putting in" })).toHaveTextContent("1 card put in your album.");
  });
});

describe("AL55: with reduced motion every put-in shows its end state at once", () => {
  it("flies nothing and lands the answer's items together", async () => {
    preferReducedMotion();
    const { user } = visit(withTray(albumFixtures.midway, [juno, banana]), { putAllIn: async () => ({ kind: "placed", items: [banana, juno], more: false }) });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 2" }));

    expect(await (await topBar()).findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
    expect(document.querySelectorAll(".al-flight, [data-beckon]").length).toBe(0);
    expect((await sidebar()).getByRole("link", { name: /Lanterns/ })).toHaveTextContent("Ready to unlock");
  });
});

describe("AL11: a refused or unreachable put-in says so and leaves the tray as getAlbum shows it", () => {
  it("a refusal stops the sequence and says it", async () => {
    preferReducedMotion();
    let call = 0;
    const { user, putAllIn } = visit(withTray(albumFixtures.midway, [juno, rook, banana]), { putAllIn: async () => (call++ === 0 ? { kind: "placed", items: [banana], more: true } : { kind: "refused" }) });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 3" }));

    expect(await screen.findByRole("status", { name: "Putting in" })).toHaveTextContent("1 card put in your album. The rest couldn't be put in. Try again.");
    expect(putAllIn).toHaveBeenCalledTimes(2);
    expect((await topBar()).getByRole("button", { name: "Tray, 2 to put in" })).toBeInTheDocument();
  });

  it("an unreachable server says so, and the panel offers the items again", async () => {
    preferReducedMotion();
    const { user } = visit(withTray(albumFixtures.midway, [juno]), {
      putIn: async () => {
        throw new Error("offline");
      },
    });

    await user.click((await openTheTray(user)).getByRole("button", { name: "Put Juno Park's card in" }));

    expect(await screen.findByRole("status", { name: "Putting in" })).toHaveTextContent("Can't reach HedgeHug. Try again.");
    expect((await openTheTray(user)).getByRole("button", { name: "Put Juno Park's card in" })).toBeInTheDocument();
  });
});

describe("AL54: putting in and the pack opening never overlap", () => {
  it("the packs button opens nothing while the cards are being put in", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = visit({ ...albumFixtures.midway, tray: [juno, banana] }, { putAllIn: async () => ({ kind: "placed", items: [banana, juno], more: false }) });
    await user.click((await openTheTray(user)).getByRole("button", { name: "Put them all in · 2" }));
    const bar = await topBar();
    await bar.findByRole("button", { name: "Tray, putting in, 2 to go" });

    await user.click(bar.getByRole("button", { name: /^Open your packs/ }));

    expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument();
    expect(bar.getByRole("button", { name: /^Open your packs/ })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("AL47: /book#packs opens the tray", () => {
  it("lands on the packs page with the tray panel open", async () => {
    visit(withTray(albumFixtures.midway, [juno]), {}, { path: "/book#packs" });

    expect(await screen.findByRole("region", { name: "Tray" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Tray" })).getByRole("button", { name: "Put Juno Park's card in" })).toBeInTheDocument();
  });
});

describe("AL47: the last pack's end offers to put everything in", () => {
  it("Put them all in flies the cards into the tray, then puts the whole tray in", async () => {
    preferReducedMotion();
    const opened: TrayItem[] = [juno, banana];
    const { user, putAllIn } = visit(
      { ...albumFixtures.onePack, tray: [rook] },
      {
        openThoughtfulPack: async () => ({ kind: "opened", items: opened, applied: null }),
        putAllIn: async () => ({ kind: "placed", items: [banana, rook, juno], more: false }),
      },
    );
    await user.click((await topBar()).getByRole("button", { name: /^Open your packs/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Open your packs" }));
    await user.click(dialog.getByRole("button", { name: "Rip open the pack for thanking Juno Park" }));

    await user.click(await dialog.findByRole("button", { name: "Put them all in" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Open your packs" })).not.toBeInTheDocument());
    expect(putAllIn).toHaveBeenCalledTimes(1);
    expect(await (await topBar()).findByRole("button", { name: "Tray, nothing to put in" })).toBeInTheDocument();
  });
});
