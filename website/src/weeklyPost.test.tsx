import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { settingsFixtures, weeklyPostParts } from "./settingsFixtures";
import type { SettingsShown } from "./settingsRead";
import { type MySettings, type ShellActions, type WeeklyPostChannelReply, type WeeklyPostReply, type WeeklyPostSetting } from "./shell";
import { renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

async function showSettings(settings: MySettings, setWeeklyPost?: ShellActions["setWeeklyPost"], pickWeeklyPostChannel?: ShellActions["pickWeeklyPostChannel"]) {
  let shown: SettingsShown = settings;
  const view = await renderSettingsPage((asking) => (asking ? shown : undefined), { setWeeklyPost, pickWeeklyPostChannel });
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

function channelForm() {
  return within(weeklyPostSection()).getByRole("form", { name: "Weekly post channel" });
}

function linkField() {
  return within(channelForm()).getByRole("textbox", { name: "Post it in another channel" });
}

function channelStatus() {
  return within(channelForm()).getByRole("status");
}

function useThisChannel() {
  return within(channelForm()).getByRole("button", { name: "Use this channel" });
}

function withCheck(check: NonNullable<WeeklyPostSetting["channelPick"]>["check"], setting: WeeklyPostSetting = weeklyPostParts.unpicked): WeeklyPostSetting {
  return { ...setting, channelPick: { picked: setting.channelPick?.picked ?? null, check } };
}

const pickedLink = "https://hedgehug.slack.com/archives/C0PICKED1";

describe("the maintainer picks the weekly post's channel only through pickWeeklyPostChannel", { timeout: 60_000 }, () => {
  it("offers no picker while the read carries no channel pick, as while weekly-post-channel is off", async () => {
    await showSettings(forTheMaintainer());

    expect(within(weeklyPostSection()).queryByRole("form", { name: "Weekly post channel" })).not.toBeInTheDocument();
    expect(within(weeklyPostSection()).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers the picker beside the announcement channel while none is picked", async () => {
    await showSettings(forTheMaintainer(weeklyPostParts.unpicked));

    expect(weeklyPostSection()).toHaveTextContent("I can post last week's top thoughtful kudos in the announcement channel.");
    expect(linkField()).toHaveValue("");
    expect(within(channelForm()).getByText("In Slack, right-click a public channel and pick Copy, then Copy link. Paste it here.")).toBeInTheDocument();
  });

  it("names the picked channel and links it in Slack", async () => {
    await showSettings(forTheMaintainer(weeklyPostParts.picked));

    expect(weeklyPostSection()).toHaveTextContent("Every Monday at 9:00, Europe/Berlin time, I post last week's top thoughtful kudos in #kudos-weekly.");
    expect(within(weeklyPostSection()).getByRole("link", { name: "#kudos-weekly" })).toHaveAttribute("href", pickedLink);
  });

  it("names the picked channel without a link until Slack has told me the workspace's address", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.picked, channelLink: null }));

    expect(weeklyPostSection()).toHaveTextContent("in #kudos-weekly.");
    expect(within(weeklyPostSection()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("sends the pasted link once, says it is checking the channel, and once the read names it says it is picked", async () => {
    let answer: (reply: WeeklyPostChannelReply) => void = () => undefined;
    const later = new Promise<WeeklyPostChannelReply>((resolve) => (answer = resolve));
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, () => later);

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    await user.click(useThisChannel());

    expect(actions.pickWeeklyPostChannel).toHaveBeenCalledTimes(1);
    expect(actions.pickWeeklyPostChannel).toHaveBeenCalledWith(pickedLink);
    expect(useThisChannel()).toHaveAttribute("aria-disabled", "true");
    await act(async () => answer({ kind: "checking" }));
    showSettingsAnswer(forTheMaintainer(withCheck("checking")));
    expect(channelStatus()).toHaveTextContent("Checking the channel…");
    expect(linkField()).toHaveValue("");
    showSettingsAnswer(forTheMaintainer({ ...weeklyPostParts.picked, on: false }));
    expect(channelStatus()).toHaveTextContent("Picked. From now on I post it in #kudos-weekly.");
  });

  it("says the channel is picked when the same channel is picked again and the read never shows the check", async () => {
    const { user } = await showSettings(forTheMaintainer(weeklyPostParts.picked), undefined, async () => ({ kind: "checking" }));

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());

    expect(channelStatus()).toHaveTextContent("Picked. From now on I post it in #kudos-weekly.");
  });

  it.each([
    ["private", "That channel is private. I only post in public channels, since the post quotes public kudos."],
    ["not-found", "I couldn't find that channel in this workspace. Check the link and try again."],
    ["archived", "That channel is archived. Pick another one."],
    ["failed", "Slack didn't answer about that channel. Try again."],
  ] as const)("says why the channel wasn't picked when its check reads %s, and that the post stays where it was", async (check, line) => {
    await showSettings(forTheMaintainer(withCheck(check, weeklyPostParts.picked)));

    expect(channelStatus()).toHaveTextContent(line);
    expect(weeklyPostSection()).toHaveTextContent("I post last week's top thoughtful kudos in #kudos-weekly.");
  });

  it("says so when the pasted text isn't a channel link", async () => {
    const { user } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, async () => ({ kind: "refused", reason: "not-a-channel-link" }));

    await user.type(linkField(), "#kudos-weekly");
    await user.click(useThisChannel());

    expect(channelStatus()).toHaveTextContent("That isn't a link to a Slack channel. Copy it from the channel in Slack.");
    expect(linkField()).toHaveValue("#kudos-weekly");
  });

  it("says when the pick was refused", async () => {
    const { user } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, async () => ({ kind: "refused", reason: null }));

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());

    expect(channelStatus()).toHaveTextContent("That couldn't be changed.");
  });

  it("keeps the button off until something is pasted", async () => {
    await showSettings(forTheMaintainer(weeklyPostParts.unpicked));

    expect(useThisChannel()).toHaveAttribute("aria-disabled", "true");
  });

  it("says when I couldn't post in the picked channel last time, and to pick another one", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.picked, cantPost: true }));

    expect(weeklyPostSection()).toHaveTextContent("I can't post in #kudos-weekly. Add me to it, or pick another channel below.");
  });

  it("says when I couldn't post in the announcement channel, and to pick another one", async () => {
    await showSettings(forTheMaintainer({ ...weeklyPostParts.unpicked, cantPost: true }));

    expect(weeklyPostSection()).toHaveTextContent("I can't post in the announcement channel. Add me to it, or pick another channel below.");
  });

  it("has no accessibility violations with the picker", async () => {
    await showSettings(forTheMaintainer(withCheck("private", { ...weeklyPostParts.picked, cantPost: true })));

    const { violations } = await axe.run(weeklyPostSection());

    expect(violations).toEqual([]);
  });
});
