import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { matchingAskedOn, matchingSettingsHrefOf } from "./book/spread/matching";
import { collectionFixtures } from "./collectionFixtures";
import type { Collection, CollectionShown } from "./collectionRead";
import { routeOf } from "./route";
import { markSeen } from "./crates/seen";
import type { SettingsRead } from "./settingsRead";
import { shellFixtures, type MemberProfile } from "./shell";
import { teamPages } from "./teamPagesFixtures";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme, preferWideScreen } from "./test/systemTheme";

vi.setConfig({ testTimeout: 60_000 });

const theBook = bookFixtures.everyLadder;

const withTeams = collectionFixtures.withTeamPages;

const reader: MemberProfile = { ...shellFixtures.memberWithTheBookOpened, bookSpread: true };

const adminSettings: SettingsRead = (asking) => (asking ? { kind: "settings", board: null, messages: null, group: null, admin: { members: [], profiles: [] } } : undefined);

beforeEach(() => {
  fakeSystemTheme(false);
  preferWideScreen();
  localStorage.clear();
});

function visit(path: string) {
  window.history.replaceState(null, "", path);
}

function address() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function showBook(member: MemberProfile = reader, collection: CollectionShown = withTeams, readSettings?: SettingsRead) {
  return renderApp(member, undefined, {}, undefined, fixedBook(theBook), undefined, undefined, undefined, undefined, undefined, readSettings, (asking) => (asking ? collection : undefined));
}

function main() {
  return screen.getByRole("main");
}

function tab(name: RegExp | string) {
  return within(within(main()).getByRole("navigation", { name: "Book pages" })).getByRole("link", { name });
}

function book() {
  return main().querySelector<HTMLElement>("[data-spread]")!;
}

function page(side: "left" | "right") {
  return book().querySelector<HTMLElement>(`[data-page="${side}"]`)!;
}

function slotsIn(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("[data-slot]")];
}

function crestArtOf(root: HTMLElement) {
  return root.querySelector<HTMLElement>("[data-crest-art]")!;
}

const workflows = teamPages.find(({ team }) => team === "workflows")!;

describe("#607: with team pages in the collection, the Teams chapter shows teams of people from posthog.com", () => {
  it("counts crests on the Teams tab and shows people collected, crests earned and the member's own crest on the cover", () => {
    visit("/book");
    showBook();
    expect(tab("Teams, 3 of 8 crests")).toHaveTextContent("3/8");
    const teams = within(page("right")).getByRole("link", { name: "Teams, 11 of 47 people collected, 3 crests earned" });
    expect(teams).toHaveAttribute("href", "/book#teams");
    expect(teams).toHaveTextContent("11");
    expect(teams).toHaveTextContent("of 47 people collected");
    expect(teams).toHaveTextContent("3 crests earned of 8");
    expect(teams).toHaveTextContent("14 stickers of teammates");
    expect(teams.querySelector("[data-own-crest]")).toHaveAttribute("data-own-crest", "cloud-platform");
    expect(book()).not.toHaveTextContent(/album/i);
  });

  it("lists a kept roster crest and a crest on a listed page under what's new, each leading to its team page, and marks them seen for the next visit", () => {
    for (const { seen } of withTeams.hoggies) if (seen !== null) markSeen(seen);
    for (const { seen } of withTeams.stickers) markSeen(seen);
    visit("/book");
    showBook();
    const fresh = within(page("right")).getByRole("heading", { name: "New since your last visit" }).parentElement!;
    expect(within(fresh).getByRole("link", { name: /People & Ops crest/ })).toHaveAttribute("href", "/book#teams/people-ops");
    expect(within(fresh).getByRole("link", { name: /Editorial crest/ })).toHaveAttribute("href", "/book#teams/editorial");
    cleanup();
    visit("/book");
    showBook();
    expect(page("right")).toHaveTextContent("Nothing new since your last visit.");
  });

  it("lays the Teams spread out from team pages: your teams with faces and silhouettes, pages started, the rest not started, and kept crests last", async () => {
    visit("/book");
    const app = showBook();
    await app.user.click(tab(/^Teams/));
    expect(address()).toBe("/book#teams");
    const left = page("left");
    const yours = within(left).getByRole("heading", { name: "Your teams" }).parentElement!.parentElement!;
    const mine = within(yours).getAllByRole("link");
    expect(mine.map((link) => link.getAttribute("href"))).toEqual(["/book#teams/cloud-platform", "/book#teams/workflows"]);
    const workflowsRow = within(yours).getByRole("link", { name: /^Workflows\s?\d/ });
    expect(workflowsRow).toHaveTextContent("3/5");
    expect(workflowsRow.querySelectorAll(".bk-face")).toHaveLength(5);
    expect(workflowsRow.querySelectorAll("[data-silhouette]")).toHaveLength(2);
    expect(within(left).getByRole("heading", { name: "Pages started" })).toBeInTheDocument();
    const started = within(left).getByRole("heading", { name: "Pages started" }).parentElement!.parentElement!;
    expect(within(started).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/book#teams/editorial", "/book#teams/platform-features", "/book#teams/support"]);
    expect(within(left).getByRole("heading", { name: "Stickers" })).toBeInTheDocument();
    const right = page("right");
    const untouched = within(right).getByRole("heading", { name: /^Not started/ }).parentElement!.parentElement!;
    expect(within(untouched).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/book#teams/hedgehog-labs", "/book#teams/night-shift"]);
    const kept = within(right).getByRole("heading", { name: /^Kept crests/ }).parentElement!.parentElement!;
    expect(within(kept).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/book#teams/people-ops"]);
    expect(book()).not.toHaveTextContent(/Archive|group|album|roster|hoggies on/i);
    cleanup();
    visit("/book#teams/archive");
    showBook();
    expect(book()).toHaveAttribute("data-spread", "teams");
  });

  it("opens a team as a Panini spread: crest, name and leads on the left, numbered stickers of collected people with face, name, role and a lead marker, printed empty slots for the rest, and the unmatched line", () => {
    visit("/book#teams/workflows");
    showBook();
    expect(book()).toHaveAttribute("data-spread", "team");
    expect(book()).toHaveAccessibleName("Workflows album");
    const left = page("left");
    expect(within(left).getByText("Your team")).toBeInTheDocument();
    expect(within(left).getByRole("heading", { level: 2, name: "Workflows" })).toBeInTheDocument();
    expect(left).toHaveTextContent("5 people to collect · led by Noor Haddad, Hana Kowalski");
    expect(left).toHaveTextContent("Collect everyone on Workflows to earn its crest.");
    expect(left).toHaveTextContent("2 still to collect");
    expect(left).toHaveTextContent("Still to swap thanks with Hana Kowalski, Omar Siddiqui.");
    const right = page("right");
    const slots = slotsIn(right);
    expect(slots.map((slot) => [slot.dataset.slot, slot.dataset.held])).toEqual(workflows.people.map((person) => [person.key, person.held ? "held" : "missing"]));
    const noor = slots[0]!;
    expect(noor).toHaveTextContent("Noor Haddad");
    expect(noor).toHaveTextContent("Lead");
    expect(noor).toHaveTextContent("Product Engineer");
    expect(noor.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^data:image/));
    expect(noor).toHaveTextContent("Since 14 Oct 2026");
    expect(slots[1]).not.toHaveTextContent("Lead");
    const hana = slots[3]!;
    expect(hana).toHaveTextContent("Hana Kowalski");
    expect(hana).toHaveTextContent("Designer");
    expect(hana).toHaveTextContent("Lead");
    expect(hana).toHaveTextContent("Not collected yet");
    expect(hana.querySelector("img")).toBeNull();
    expect(hana.querySelector("[data-silhouette]")).not.toBeNull();
    expect(right).toHaveTextContent("1 person on this team isn't linked to a teammate yet: Quill Harper.");
    expect(within(right).queryByRole("link", { name: /Settings/ })).toBeNull();
    expect(within(right).queryByLabelText("Album complete")).toBeNull();
  });

  it("shows the crest in colour and the Complete stamp once everyone on a team is collected, keeps a roster crest on its page, and says when no one on a team is on Slack yet", () => {
    visit("/book#teams/platform-features");
    showBook();
    expect(page("left")).toHaveTextContent("The Platform Features crest is yours.");
    expect(crestArtOf(page("left"))).toHaveAttribute("data-crest-art", "collected");
    expect(within(page("right")).getByLabelText("Album complete")).toBeInTheDocument();
    cleanup();
    visit("/book#teams/editorial");
    showBook();
    expect(page("left")).toHaveTextContent("The Editorial crest is yours.");
    expect(page("left")).toHaveTextContent("Collected 20 Sept 2026.");
    expect(page("left")).toHaveTextContent("2 still to collect");
    expect(within(page("right")).queryByLabelText("Album complete")).toBeNull();
    cleanup();
    visit("/book#teams/people-ops");
    showBook();
    expect(page("left")).toHaveTextContent("The People & Ops crest is yours.");
    expect(page("right")).toHaveTextContent("No one to collect on this team yet.");
    expect(slotsIn(page("right"))).toHaveLength(0);
  });

  it("draws the default crest for a team without art, the posthog.com picture for an image crest, and the default once that picture fails", () => {
    visit("/book#teams/night-shift");
    showBook();
    expect(crestArtOf(page("left"))).toHaveAttribute("data-crest-kind", "default");
    expect(page("left")).toHaveTextContent("Night Shift");
    cleanup();
    visit("/book#teams/hedgehog-labs");
    showBook();
    const crest = crestArtOf(page("left"));
    expect(crest).toHaveAttribute("data-crest-kind", "image");
    const picture = crest.querySelector("img")!;
    expect(picture.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    fireEvent.error(picture);
    expect(crestArtOf(page("left"))).toHaveAttribute("data-crest-kind", "default");
  });

  it("pages a large team's stickers in sheets of twelve and caps the faces on its row", async () => {
    visit("/book#teams");
    const app = showBook();
    const row = within(page("left")).getByRole("link", { name: /^Cloud Platform\s?\d/ });
    expect(row).toHaveTextContent("2/30");
    expect(row.querySelectorAll(".bk-face")).toHaveLength(8);
    expect(row).toHaveTextContent("+22");
    await app.user.click(row);
    expect(address()).toBe("/book#teams/cloud-platform");
    const right = page("right");
    expect(page("left")).toHaveTextContent("Still to swap thanks with Chiara Castillo, Dmitri Dubois, Esme Eriksen, Farid Ferreira, Greta Gallo, Hugo Horvat and 22 more.");
    expect(slotsIn(right)).toHaveLength(12);
    expect(right).toHaveTextContent("Stickers 1–12");
    expect(right).toHaveTextContent("Sheet 1 of 3");
    expect(within(right).getByRole("button", { name: /Previous sheet/ })).toHaveAttribute("aria-disabled", "true");
    await app.user.click(within(right).getByRole("button", { name: /Previous sheet/ }));
    expect(page("right")).toHaveTextContent("Sheet 1 of 3");
    await app.user.click(within(right).getByRole("button", { name: /Next sheet/ }));
    expect(slotsIn(page("right"))).toHaveLength(12);
    expect(page("right")).toHaveTextContent("Stickers 13–24");
    await app.user.click(within(page("right")).getByRole("button", { name: /Next sheet/ }));
    expect(slotsIn(page("right"))).toHaveLength(6);
    expect(page("right")).toHaveTextContent("Sheet 3 of 3");
    expect(within(page("right")).getByRole("button", { name: /Next sheet/ })).toHaveAttribute("aria-disabled", "true");
    expect(within(page("right")).getByRole("button", { name: /Next sheet/ })).toHaveFocus();
    await app.user.click(within(page("right")).getByRole("button", { name: /Previous sheet/ }));
    expect(page("right")).toHaveTextContent("Sheet 2 of 3");
  });

  it("falls back to initials when a person's picture fails to load", () => {
    visit("/book#teams/workflows");
    showBook();
    const priya = slotsIn(page("right")).find((slot) => slot.dataset.slot === "k:priya")!;
    fireEvent.error(priya.querySelector("img")!);
    expect(priya.querySelector("img")).toBeNull();
    expect(priya).toHaveTextContent("PN");
  });

  it("links an admin from the unmatched line to the matching settings only once the route list has the section", () => {
    const sections = ["visibility", "messages", "group", "admin"];
    const admin = { kind: "settings" as const, board: null, messages: null, group: null, admin: { members: [], profiles: [] } };
    expect(matchingSettingsHrefOf(admin, sections)).toBeNull();
    expect(matchingSettingsHrefOf(admin, [...sections, "company-profile"])).toBe("/settings?section=company-profile");
    expect(matchingSettingsHrefOf({ ...admin, admin: undefined }, [...sections, "company-profile"])).toBeNull();
    expect(matchingSettingsHrefOf({ kind: "not-found" }, [...sections, "company-profile"])).toBeNull();
    expect(matchingSettingsHrefOf(undefined, [...sections, "company-profile"])).toBeNull();
    visit("/book#teams/workflows");
    showBook(reader, withTeams, adminSettings);
    expect(page("right")).toHaveTextContent("1 person on this team isn't linked to a teammate yet: Quill Harper.");
    expect(within(page("right")).queryByRole("link", { name: /Settings/ })).toBeNull();
  });

  it("asks for the settings only on the spread of a team with people to match, with the spread on and the section in the route list", () => {
    const withTheSection = ["visibility", "messages", "group", "admin", "company-profile"];
    const route = (path: string) => routeOf(new URL(path, "https://hedgehug.test"));
    expect(matchingAskedOn(reader, route("/book#teams/workflows"), withTeams, withTheSection)).toBe(true);
    expect(matchingAskedOn(reader, route("/book/collection#teams/support"), withTeams, withTheSection)).toBe(true);
    expect(matchingAskedOn(reader, route("/book#teams/platform-features"), withTeams, withTheSection)).toBe(false);
    expect(matchingAskedOn(reader, route("/book#teams/nope"), withTeams, withTheSection)).toBe(false);
    expect(matchingAskedOn(reader, route("/book#teams"), withTeams, withTheSection)).toBe(false);
    expect(matchingAskedOn(reader, route("/book"), withTeams, withTheSection)).toBe(false);
    expect(matchingAskedOn(reader, route("/book#teams/workflows"), collectionFixtures.withTheStickerBook, withTheSection)).toBe(false);
    expect(matchingAskedOn(shellFixtures.memberWithTheBookOpened, route("/book#teams/workflows"), withTeams, withTheSection)).toBe(false);
    expect(matchingAskedOn(reader, route("/book#teams/workflows"), withTeams, withTheSection.slice(0, 4))).toBe(false);
    const asked: boolean[] = [];
    const watching: SettingsRead = (asking) => {
      asked.push(asking);
      return asking ? { kind: "not-found" } : undefined;
    };
    for (const path of ["/book", "/book#teams", "/book#teams/workflows"]) {
      visit(path);
      showBook(reader, withTeams, watching);
      cleanup();
    }
    expect(asked.every((asking) => !asking)).toBe(true);
  });

  it("renders the chapter from an empty teams answer", () => {
    const noTeams: Collection = { ...withTeams, teams: [] };
    visit("/book#teams");
    showBook(reader, noTeams);
    expect(tab("Teams, 0 of 0 crests")).toBeInTheDocument();
    expect(book()).toHaveAttribute("data-spread", "teams");
    expect(page("left")).toHaveTextContent("No page started yet.");
  });

});
