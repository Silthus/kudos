import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aHugGiven, aHugReceived, aPage, aReceived, teammates, words } from "./activityFixtures";
import type { ActivityRead, ActivityWatch } from "./activityRead";
import { fixedQuests, questsFixtures } from "./questsFixtures";
import { fixedRecentKudos, recentKudosFixtures } from "./recentKudosFixtures";
import { shellFixtures, type Activity, type ActivityEntry, type MyActivity } from "./shell";
import { renderApp } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

const now = Date.parse("2026-10-14T18:00:00Z");

const minute = 60 * 1000;

const permalink = "https://example.slack.com/archives/C1/p1";

beforeEach(() => {
  fakeSystemTheme(false);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  window.history.replaceState(null, "", "/activity");
});

afterEach(() => {
  vi.useRealTimers();
});

function opening(watched: Activity) {
  const asked: ((answer: MyActivity) => void)[] = [];
  const read: ActivityRead = () => new Promise((resolve) => asked.push(resolve));
  const watch: ActivityWatch = (filter) => (filter === undefined ? undefined : watched);
  const view = renderApp(shellFixtures.memberWithEveryPanelOpen, undefined, undefined, fixedQuests(questsFixtures.week), undefined, undefined, undefined, fixedRecentKudos({ received: recentKudosFixtures.threeReceived, given: recentKudosFixtures.threeGiven }), { watch, read });
  const answer = (index: number, page: Activity) => act(async () => asked[index]!(page));
  return { ...view, asked, answer };
}

async function opened(entries: ActivityEntry[]) {
  const view = opening(aPage(entries, null));
  await view.answer(0, aPage(entries, null));
  return view;
}

function main() {
  return screen.getByRole("main");
}

function article(name: string) {
  return within(main()).getByRole("article", { name });
}

describe("#580: hugs received on one message show as one row on the left", () => {
  it("names the one teammate who reacted on a kudos, with the count, the XP, the kudos' words and a link to Slack", async () => {
    await opened([aHugReceived("C1/1", now - 10 * minute, { kudos: words("Thanks for the review"), permalink })]);
    const row = article("Ada Lindqvist reacted 🤗 on the kudos you received");
    expect(row).toHaveAttribute("data-side", "received");
    expect(row).toHaveTextContent("1 hug · +1 XP");
    expect(row).toHaveTextContent("Thanks for the review");
    expect(within(row).getByRole("link", { name: /Open in Slack/ })).toHaveAttribute("href", permalink);
    expect(within(row).getByText("19:50")).toBeInTheDocument();
  });

  it("names both teammates when two reacted on a message", async () => {
    await opened([aHugReceived("C1/2", now - minute, { givers: [teammates.bo, teammates.cleo], hugs: 2, xp: 2 })]);
    const row = article("Bo Okafor and Cleo Marchetti reacted 🤗 on your message");
    expect(row).toHaveTextContent("2 hugs · +2 XP");
    expect(within(row).getAllByTestId("person-face").map((face) => face.textContent)).toEqual(["BO", "CM"]);
  });

  it("names the newest giver and counts the others when six reacted, from the five givers the read holds", async () => {
    const givers = [teammates.eli, teammates.dev, teammates.cleo, teammates.bo, teammates.ada];
    await opened([aHugReceived("C1/6", now - minute, { givers, hugs: 6, xp: 6 })]);
    const row = article("Eli Brandt and 5 others reacted 🤗 on your message");
    expect(row).toHaveTextContent("6 hugs · +6 XP");
    expect(within(row).getAllByTestId("person-face")).toHaveLength(3);
  });

  it("drops the XP when it's hidden, and keeps the count", async () => {
    await opened([aHugReceived("C1/4", now - minute, { givers: [teammates.ada, teammates.bo, teammates.cleo, teammates.dev], hugs: 4, xp: null })]);
    const row = article("Ada Lindqvist and 3 others reacted 🤗 on your message");
    expect(row).toHaveTextContent("4 hugs");
    expect(row).not.toHaveTextContent("XP");
  });

  it("links nowhere when Slack's permalink is unknown", async () => {
    await opened([aHugReceived("C1/1", now - minute)]);
    expect(within(article("Ada Lindqvist reacted 🤗 on your message")).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("#580: each hug given shows as its own row on the right", () => {
  it("says whose message it was on, with the XP and a link to Slack", async () => {
    await opened([aHugGiven("h1", now - minute, { people: [teammates.bo], permalink })]);
    const row = article("You reacted 🤗 on Bo Okafor's message");
    expect(row).toHaveAttribute("data-side", "given");
    expect(row).toHaveTextContent("+1 XP");
    expect(within(row).getByRole("link", { name: /Open in Slack/ })).toHaveAttribute("href", permalink);
  });

  it("says whose kudos it was on, and shows its words", async () => {
    await opened([aHugGiven("h2", now - minute, { people: [teammates.cleo, teammates.dev], kudos: words("Thank you both for the launch") })]);
    const row = article("You reacted 🤗 on Cleo Marchetti and Dev Rao's kudos");
    expect(row).toHaveTextContent("Thank you both for the launch");
  });

  it("drops the XP when it's hidden", async () => {
    await opened([aHugGiven("h3", now - minute, { xp: null })]);
    expect(article("You reacted 🤗 on Bo Okafor's message")).not.toHaveTextContent("XP");
  });
});

describe("#580: the reacted emoji is drawn inline", () => {
  it("draws a skin-toned standard emoji as its character", async () => {
    await opened([aHugGiven("h1", now - minute, { emoji: "+1::skin-tone-3" })]);
    expect(article("You reacted 👍🏼 on Bo Okafor's message")).toBeInTheDocument();
  });

  it("draws a custom emoji from its picture", async () => {
    await opened([aHugReceived("C1/1", now - minute, { emoji: "hedgehug::skin-tone-3", emojiImage: "https://emoji.slack-edge.com/T1/hedgehug/abc.png" })]);
    const row = article("Ada Lindqvist reacted :hedgehug: on your message");
    expect(within(row).getByRole("img", { name: ":hedgehug:" })).toHaveAttribute("src", "https://emoji.slack-edge.com/T1/hedgehug/abc.png");
  });

  it("names a custom emoji without a picture in a chip", async () => {
    await opened([aHugGiven("h1", now - minute, { emoji: "partyparrot" })]);
    const row = article("You reacted :partyparrot: on Bo Okafor's message");
    expect(within(row).getByText(":partyparrot:")).toHaveAttribute("data-custom-emoji");
    expect(row.querySelector("img")).toBeNull();
  });
});

describe("#580: a hug landing on a shown message raises new activity, and shows the row once", () => {
  const kudos = aReceived("r1", now - 20 * minute);
  const hugged = aHugReceived("C1/7", now - 30 * minute);
  const huggedAgain = aHugReceived("C1/7", now - minute, { givers: [teammates.bo, teammates.ada], hugs: 2, xp: 2 });

  it("offers the moved row, then shows it once at the top with the new count", async () => {
    const { user, answer, asked } = opening(aPage([huggedAgain, kudos], null));
    await answer(0, aPage([kudos, hugged], null));
    await user.click(within(main()).getByRole("button", { name: "Show new activity" }));
    expect(asked).toHaveLength(2);
    await answer(1, aPage([huggedAgain, kudos], null));
    const rows = within(main()).getAllByRole("article");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName("Bo Okafor and Ada Lindqvist reacted 🤗 on your message");
    expect(rows[0]).toHaveTextContent("2 hugs · +2 XP");
    expect(within(main()).queryByRole("button", { name: "Show new activity" })).not.toBeInTheDocument();
  });
});

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

describe("#580: hug rows pass axe in light and dark", () => {
  for (const dark of [false, true]) {
    it(`in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const { container } = await opened([
        aHugReceived("C1/1", now - minute, { givers: [teammates.ada, teammates.bo, teammates.cleo], hugs: 3, kudos: words("Thanks for the review"), permalink }),
        aHugGiven("h1", now - 2 * minute, { emoji: "hedgehug", emojiImage: "https://emoji.slack-edge.com/T1/hedgehug/abc.png", permalink }),
        aHugGiven("h2", now - 3 * minute, { emoji: "partyparrot", xp: null }),
      ]);
      const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
