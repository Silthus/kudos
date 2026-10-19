import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { settingsFixtures, weeklyPostParts } from "./settingsFixtures";
import type { SettingsShown } from "./settingsRead";
import { type MySettings, type ShellActions, type WeeklyPostReply, type WeeklyPostSetting } from "./shell";
import { renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

async function showSettings(settings: MySettings, setWeeklyPost?: ShellActions["setWeeklyPost"]) {
  let shown: SettingsShown = settings;
  const view = await renderSettingsPage((asking) => (asking ? shown : undefined), { setWeeklyPost });
  const showSettingsAnswer = (next: MySettings) => {
    shown = next;
    view.showSettingsAgain();
  };
  return { ...view, showSettingsAnswer };
}

function forTheMaintainer(weeklyPost: WeeklyPostSetting = weeklyPostParts.off): MySettings {
  return { ...settingsFixtures.forTheMaintainer, weeklyPost };
}

function answerLater() {
  let resolve: (answer: WeeklyPostReply) => void = () => undefined;
  const answer = new Promise<WeeklyPostReply>((settle) => {
    resolve = settle;
  });
  return { answer, resolve };
}

function weeklyPostSection() {
  return within(screen.getByRole("main")).getByRole("region", { name: "Weekly post" });
}

function theSwitch() {
  return within(weeklyPostSection()).getByRole("switch", { name: "Post it every Monday" });
}

function status() {
  return within(weeklyPostSection()).getByRole("status");
}

describe("the maintainer switches the weekly post only through setWeeklyPost", { timeout: 60_000 }, () => {
  it("leaves the section out while the read carries no weekly post, as for everyone but the maintainer", async () => {
    const { weeklyPost: _, ...withoutWeeklyPost } = settingsFixtures.forTheMaintainer;
    await showSettings(withoutWeeklyPost);

    expect(within(screen.getByRole("main")).queryByRole("region", { name: "Weekly post" })).not.toBeInTheDocument();
  });

  it("says what it posts, where and when, and links the announcement channel in Slack", async () => {
    await showSettings(forTheMaintainer());

    expect(weeklyPostSection()).toHaveTextContent("Every Monday at 9:00, Europe/Berlin time, I can post last week's top thoughtful kudos in the announcement channel.");
    expect(within(weeklyPostSection()).getByRole("link", { name: "the announcement channel" })).toHaveAttribute("href", "https://hedgehug.slack.com/archives/C_ANNOUNCE");
    expect(theSwitch()).not.toBeChecked();
  });

  it("names the channel without a link until Slack has told me the workspace's address", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.off, channelLink: null }));

    expect(weeklyPostSection()).toHaveTextContent("in the announcement channel.");
    expect(within(weeklyPostSection()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("names the groups post where the album's weekly post isn't on, and a time zone with spaces", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.on, posts: "groups", timeZone: "America/New_York" }));

    expect(weeklyPostSection()).toHaveTextContent("Every Monday at 9:00, America/New York time, I post last week's top groups in the announcement channel.");
    expect(theSwitch()).toBeChecked();
  });

  it("sends the switch once, holds it until it answers, and says so once the read shows it on", async () => {
    const later = answerLater();
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(), () => later.answer);

    await user.click(theSwitch());
    await user.click(theSwitch());

    expect(actions.setWeeklyPost).toHaveBeenCalledTimes(1);
    expect(actions.setWeeklyPost).toHaveBeenCalledWith(true);
    expect(theSwitch()).toHaveAttribute("aria-disabled", "true");
    await act(async () => later.resolve({ kind: "set" }));
    showSettingsAnswer(forTheMaintainer(weeklyPostParts.on));
    expect(theSwitch()).toBeChecked();
    expect(status()).toHaveTextContent("Switched on. The next one goes out on Monday at 9:00.");
  });

  it("switches it off and says nothing goes out until it is on again", async () => {
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.on), async () => ({ kind: "set" }));

    await user.click(theSwitch());
    showSettingsAnswer(forTheMaintainer());

    expect(actions.setWeeklyPost).toHaveBeenCalledWith(false);
    expect(status()).toHaveTextContent("Switched off. Nothing goes out until it's switched on again.");
  });

  it("says when the switch was refused and leaves it as the read shows it", async () => {
    const { user } = await showSettings(forTheMaintainer(), async () => ({ kind: "refused" }));

    await user.click(theSwitch());

    expect(theSwitch()).not.toBeChecked();
    expect(status()).toHaveTextContent("That couldn't be changed.");
  });

  it("says when I couldn't post in the channel last time", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.on, cantPost: true }));

    expect(weeklyPostSection()).toHaveTextContent("I can't post in the announcement channel. Add me to it, or ask a workspace admin to pick another channel in App Home's Admin tab.");
  });

  it("has no accessibility violations", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.on, cantPost: true }));

    const { violations } = await axe.run(weeklyPostSection());

    expect(violations).toEqual([]);
  });
});
