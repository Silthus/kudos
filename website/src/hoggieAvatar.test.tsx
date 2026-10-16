import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookFixtures, fixedBook } from "./bookFixtures";
import { collectionFixtures, fixedCollection } from "./collectionFixtures";
import type { MyCollection } from "./collectionRead";
import { hoggiePictureOf } from "./crates/Hoggie";
import { fixedLeaderboard, leaderboardFixtures } from "./leaderboardFixtures";
import { fixtureRecentKudos } from "./recentKudosFixtures";
import type { CollectionHoggie } from "./collectionRead";
import { fixedProfileCard, profileCardFixtures } from "./profileCardFixtures";
import type { ProfileCardRead } from "./profileCardRead";
import { shellFixtures, type Avatar, type MemberProfile, type MyBook, type MyProfileCard, type ShellActions } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

vi.setConfig({ testTimeout: 90_000 });

const theCollection = collectionFixtures.collection;

const held = theCollection.hoggies.filter(({ count }) => count > 0);

const missing = theCollection.hoggies.find(({ count }) => count === 0)!;

function avatarOf({ hoggie, name, rarity, art }: CollectionHoggie): Avatar {
  return { hoggie, name, rarity, art };
}

const asleep = avatarOf(held.find(({ hoggie }) => hoggie === "asleep")!);

const heart = held.find(({ hoggie }) => hoggie === "heart")!;

const slackPicture = "https://avatars.slack-edge.com/sam_192.png";

const sam: MemberProfile = { ...shellFixtures.memberWithTheBookOpened, face: { kind: "slack", image: slackPicture, initials: "SE" } };

const withAvatar = (avatar: Avatar | null | undefined): MemberProfile => (avatar === undefined ? sam : { ...sam, avatar });

const cardShowing = (avatar: Avatar | null | undefined): MyProfileCard => (avatar === undefined ? profileCardFixtures.bestFour : { ...profileCardFixtures.bestFour, avatar });

const brokenCard: ProfileCardRead = (asking) => (asking ? { kind: "broken" } : undefined);

type Shown = { member: MemberProfile; readCard?: ProfileCardRead; setAvatar?: ShellActions["setAvatar"]; collection?: MyCollection };

function show({ member, readCard = fixedProfileCard(cardShowing(member.avatar)), setAvatar, collection = theCollection }: Shown) {
  return renderApp(member, fixedLeaderboard(leaderboardFixtures.midBoard), { setAvatar }, undefined, fixedBook(bookFixtures.everyLadder as MyBook), undefined, readCard, fixtureRecentKudos, undefined, undefined, undefined, fixedCollection(collection));
}

function header() {
  return screen.getByRole("link", { name: new RegExp(`^${sam.name}`) });
}

function hero() {
  return screen.getByRole("region", { name: sam.name });
}

function teammatesSee() {
  return screen.getByRole("region", { name: "What teammates see" });
}

function ownFaces() {
  return [header(), hero(), teammatesSee()];
}

function avatarIn(place: HTMLElement) {
  return place.querySelector<HTMLElement>("[data-avatar]");
}

function slackPictureIn(place: HTMLElement) {
  return place.querySelector(`img[src="${slackPicture}"]`);
}

function tile(hoggie: string) {
  return screen.getByRole("main").querySelector<HTMLElement>(`[data-hoggie="${hoggie}"]`)!;
}

function onTheHome() {
  window.history.replaceState(null, "", "/");
}

function onTheCollection() {
  window.history.replaceState(null, "", "/book/collection");
}

beforeEach(() => {
  fakeSystemTheme(false);
  localStorage.clear();
});

describe("#568: a member's own face shows the hoggie they picked as their avatar", () => {
  beforeEach(onTheHome);

  it("draws the Slack picture in the header, the hero and What teammates see while the answers carry no avatar", () => {
    show({ member: withAvatar(undefined) });
    for (const place of ownFaces()) {
      expect(avatarIn(place)).toBeNull();
      expect(slackPictureIn(place)).not.toBeNull();
    }
  });

  it("draws the Slack picture everywhere while no avatar is set", () => {
    show({ member: withAvatar(null) });
    for (const place of ownFaces()) {
      expect(avatarIn(place)).toBeNull();
      expect(slackPictureIn(place)).not.toBeNull();
    }
  });

  it("draws the avatar hoggie in a ring of its rarity in place of the Slack picture in the header, the hero and What teammates see", () => {
    show({ member: withAvatar(asleep) });
    for (const place of ownFaces()) {
      const avatar = avatarIn(place);
      expect(avatar).toHaveAttribute("data-avatar", asleep.hoggie);
      expect(avatar).toHaveAttribute("data-rarity", asleep.rarity);
      expect(avatar).toHaveClass("hoggie-coin");
      expect(avatar?.style.getPropertyValue("--rarity")).toBe(`var(--rarity-${asleep.rarity})`);
      expect(avatar?.querySelector("img")).toHaveAttribute("src", hoggiePictureOf(asleep.art));
      expect(slackPictureIn(place)).toBeNull();
    }
  });

  it("never draws the avatar on another member's face, on the home's Recent kudos or on the leaderboard", () => {
    show({ member: { ...withAvatar(asleep), leaderboard: { kind: "open" } } });
    const recentKudos = screen.getByRole("region", { name: "Recent kudos" });
    expect(recentKudos.querySelectorAll("img, [aria-hidden='true'].rounded-full").length).toBeGreaterThan(0);
    expect(avatarIn(recentKudos)).toBeNull();
    expect(document.querySelectorAll("[data-avatar]")).toHaveLength(3);
    for (const place of ownFaces()) expect(avatarIn(place)).not.toBeNull();
  });

  it("draws the avatar only in the header on the leaderboard, never on a row", () => {
    window.history.replaceState(null, "", "/leaderboard");
    show({ member: { ...withAvatar(asleep), leaderboard: { kind: "open" } } });
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(3);
    expect(document.querySelectorAll("[data-avatar]")).toHaveLength(1);
    expect(avatarIn(header())).not.toBeNull();
  });

  it("shows What teammates see from the card's own answer, and the Slack picture there while the card fails to load", () => {
    show({ member: withAvatar(asleep), readCard: brokenCard });
    expect(avatarIn(teammatesSee())).toBeNull();
    expect(slackPictureIn(teammatesSee())).not.toBeNull();
    expect(avatarIn(hero())).not.toBeNull();
  });

  it("falls back to the Slack picture where the hoggie's art fails to load", () => {
    show({ member: withAvatar(asleep) });
    fireEvent.error(avatarIn(hero())!.querySelector("img")!);
    expect(avatarIn(hero())).toBeNull();
    expect(slackPictureIn(hero())).not.toBeNull();
  });
});

describe("#568: a member picks a hoggie they hold as their avatar on /book/collection", () => {
  beforeEach(onTheCollection);

  it("offers no avatar choice while the profile carries no avatar", () => {
    show({ member: withAvatar(undefined) });
    expect(within(screen.getByRole("main")).queryByRole("button", { name: /as avatar/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Remove avatar" })).not.toBeInTheDocument();
  });

  it("offers Use as avatar on every held hoggie and none on a missing one while no avatar is set", () => {
    show({ member: withAvatar(null) });
    for (const hoggie of held) expect(within(tile(hoggie.hoggie)).getByRole("button", { name: `Use as avatar: ${hoggie.name}` })).toBeInTheDocument();
    expect(within(tile(missing.hoggie)).queryByRole("button")).not.toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("button", { name: "Remove avatar" })).not.toBeInTheDocument();
  });

  it("asks for no pick while the member holds no hoggie", () => {
    show({ member: withAvatar(null), collection: collectionFixtures.nothingFound });
    expect(screen.queryByRole("region", { name: "Your avatar" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("button", { name: /as avatar/ })).not.toBeInTheDocument();
  });

  it("marks the current avatar's tile and offers Remove avatar", () => {
    show({ member: withAvatar(asleep) });
    expect(tile(asleep.hoggie)).toHaveAttribute("data-avatar-current");
    expect(tile(asleep.hoggie)).toHaveAttribute("aria-current", "true");
    expect(tile(heart.hoggie)).not.toHaveAttribute("aria-current");
    expect(within(tile(asleep.hoggie)).getByText("Your avatar")).toBeInTheDocument();
    expect(within(tile(asleep.hoggie)).queryByRole("button", { name: /Use as avatar/ })).not.toBeInTheDocument();
    expect(within(tile(heart.hoggie)).getByRole("button", { name: `Use as avatar: ${heart.name}` })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("button", { name: "Remove avatar" })).toBeInTheDocument();
  });

  it("sends setAvatar once with the hoggie and says so once the profile shows it", async () => {
    const setAvatar = vi.fn(async (hoggie: string | null) => ({ kind: "set", avatar: hoggie === null ? null : avatarOf(heart) }) as const);
    const { user, showVisitor } = show({ member: withAvatar(asleep), setAvatar });
    await user.click(within(tile(heart.hoggie)).getByRole("button", { name: `Use as avatar: ${heart.name}` }));
    expect(setAvatar).toHaveBeenCalledTimes(1);
    expect(setAvatar).toHaveBeenCalledWith(heart.hoggie);
    showVisitor(withAvatar(avatarOf(heart)));
    expect(await screen.findByText(`${heart.name} is your avatar.`)).toHaveClass("sr-only");
    expect(within(screen.getByRole("region", { name: "Your avatar" })).getByText(`${heart.name} shows in place of your picture.`)).toBeVisible();
    expect(avatarIn(header())).toHaveAttribute("data-avatar", heart.hoggie);
    expect(tile(heart.hoggie)).toHaveAttribute("data-avatar-current");
  });

  it("goes back to the Slack picture with Remove avatar", async () => {
    const setAvatar = vi.fn(async () => ({ kind: "set", avatar: null }) as const);
    const { user, showVisitor } = show({ member: withAvatar(asleep), setAvatar });
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "Remove avatar" }));
    expect(setAvatar).toHaveBeenCalledTimes(1);
    expect(setAvatar).toHaveBeenCalledWith(null);
    showVisitor(withAvatar(null));
    expect(await screen.findByText("Your picture is back.")).toBeInTheDocument();
    expect(avatarIn(header())).toBeNull();
    expect(slackPictureIn(header())).not.toBeNull();
  });

  it("says calmly that a refused pick couldn't be changed and keeps the avatar", async () => {
    const setAvatar = vi.fn(async () => ({ kind: "refused" }) as const);
    const { user } = show({ member: withAvatar(asleep), setAvatar });
    await user.click(within(tile(heart.hoggie)).getByRole("button", { name: `Use as avatar: ${heart.name}` }));
    expect(await screen.findByText("That couldn't be changed.")).not.toHaveClass("sr-only");
    expect(avatarIn(header())).toHaveAttribute("data-avatar", asleep.hoggie);
  });

  it("holds every choice while one is sent", async () => {
    let answer: (value: { kind: "refused" }) => void = () => {};
    const setAvatar = vi.fn(() => new Promise<{ kind: "refused" }>((resolve) => (answer = resolve)));
    const { user } = show({ member: withAvatar(asleep), setAvatar });
    await user.click(within(tile(heart.hoggie)).getByRole("button", { name: `Use as avatar: ${heart.name}` }));
    const remove = within(screen.getByRole("main")).getByRole("button", { name: "Remove avatar" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    await user.click(remove);
    expect(setAvatar).toHaveBeenCalledTimes(1);
    answer({ kind: "refused" });
    await waitFor(() => expect(within(screen.getByRole("main")).getByRole("button", { name: "Remove avatar" })).not.toHaveAttribute("aria-disabled", "true"));
  });

  it("says HedgeHug couldn't be reached when the send fails", async () => {
    const setAvatar = vi.fn(async () => {
      throw new Error("offline");
    });
    const { user } = show({ member: withAvatar(null), setAvatar });
    await user.click(within(tile(heart.hoggie)).getByRole("button", { name: `Use as avatar: ${heart.name}` }));
    expect(await screen.findByText("Couldn't reach HedgeHug. Try again.")).toBeInTheDocument();
  });
});

describe("#568: the avatar passes axe in light and dark", () => {
  for (const dark of [false, true]) {
    for (const [page, go] of [["the home", onTheHome], ["the collection", onTheCollection]] as const) {
      it(`on ${page} in ${dark ? "dark" : "light"}`, async () => {
        fakeSystemTheme(dark);
        go();
        const { container } = show({ member: withAvatar(asleep) });
        const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
        expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(" ")).join(", ")}`)).toEqual([]);
      }, 120_000);
    }
  }
});
