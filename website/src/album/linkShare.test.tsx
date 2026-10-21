import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures } from "../shell";
import { renderAlbum } from "../test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "../test/systemTheme";
import { albumFixtures, fixedAlbum, fixedPeople } from "./albumFixtures";
import type { Album } from "./answer";
import { boardsFixtures, fixedBoards } from "./boardsFixtures";
import { fixedHoggies, hoggiesFixtures } from "./hoggiesFixtures";
import { fixedProfile, profileFixtures } from "./profileFixtures";

const withPreviews: Album = { ...albumFixtures.midway, linkPreviews: true };

const arrival = { timeout: 10_000 };

let copied: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  copied = vi.fn(async () => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function visit(path: string, album: Album = withPreviews) {
  window.history.replaceState(null, "", path);
  const view = renderAlbum(shellFixtures.member, fixedAlbum(album), { people: fixedPeople(album), boards: fixedBoards(boardsFixtures.week), profile: fixedProfile(profileFixtures.noted), hoggies: fixedHoggies(hoggiesFixtures.glance) });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
  return view;
}

async function shareOn(heading: string) {
  await screen.findByRole("heading", { level: 1, name: heading }, arrival);
  return screen.getByRole("button", { name: /^Share/ });
}

describe("LP83: every person and team page has a Share button that copies its link", () => {
  it("Share on a person page copies the page's link and says so", async () => {
    const view = visit("/book#people/ines-okafor");

    await view.user.click(await shareOn("Ines Okafor"));

    expect(copied).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/book#people/ines-okafor`);
    expect(await screen.findByRole("status", { name: "Sharing" })).toHaveTextContent("Link copied. Paste it in Slack to show Ines's card.");
  });

  it("Share on a team page copies the team's link", async () => {
    const view = visit("/book#teams/lanterns");

    await view.user.click(await shareOn("Lanterns"));

    expect(copied).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/book#teams/lanterns`);
    expect(await screen.findByRole("status", { name: "Sharing" })).toHaveTextContent("Link copied. Paste it in Slack to show the Lanterns card.");
  });

  it("Share on my own page copies my person link, the one teammates open", async () => {
    const view = visit("/");
    const me = withPreviews.me;

    await view.user.click(await shareOn(me.name));

    expect(copied).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/book#people/${me.person}`);
  });

  it("a browser that refuses the clipboard shows the link to copy by hand", async () => {
    copied.mockRejectedValue(new Error("denied"));
    const view = visit("/book#teams/lanterns");

    await view.user.click(await shareOn("Lanterns"));

    const said = await screen.findByRole("status", { name: "Sharing" });
    expect(said).toHaveTextContent("Copy this link to share it:");
    expect(within(said).getByRole("textbox", { name: "Link to share" })).toHaveValue(`${window.location.origin}/book#teams/lanterns`);
  });
});

describe("LP82: the Share button is behind link-previews", () => {
  it.each([
    ["a person page", "/book#people/ines-okafor", "Ines Okafor"],
    ["a team page", "/book#teams/lanterns", "Lanterns"],
    ["my own page", "/", albumFixtures.midway.me.name],
  ])("while the flag is off, %s has no Share button", async (_, path, heading) => {
    visit(path, albumFixtures.midway);

    await screen.findByRole("heading", { level: 1, name: heading }, arrival);

    expect(screen.queryByRole("button", { name: /^Share/ })).toBeNull();
  });
});
