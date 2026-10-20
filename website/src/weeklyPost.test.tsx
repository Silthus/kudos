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

function withCheck(check: NonNullable<WeeklyPostSetting["channelPick"]>["check"], setting: WeeklyPostSetting = weeklyPostParts.unpicked, pick = (setting.channelPick?.pick ?? 0) + 1): WeeklyPostSetting {
  return { ...setting, channelPick: { picked: setting.channelPick?.picked ?? null, check, pick } };
}

function pickedAgain(pick: number, on = true): WeeklyPostSetting {
  return { ...weeklyPostParts.picked, on, channelPick: { picked: "kudos-weekly", check: "picked", pick } };
}

const otherLink = "https://hedgehug.slack.com/archives/C0OTHER";

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

  it("sends the pasted link once, says it is checking the channel, and once the read names it says it is picked and empties the field", async () => {
    let answer: (reply: WeeklyPostChannelReply) => void = () => undefined;
    const later = new Promise<WeeklyPostChannelReply>((resolve) => (answer = resolve));
    const { user, actions, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, () => later);

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    await user.click(useThisChannel());

    expect(actions.pickWeeklyPostChannel).toHaveBeenCalledTimes(1);
    expect(actions.pickWeeklyPostChannel).toHaveBeenCalledWith(pickedLink);
    expect(useThisChannel()).toHaveAttribute("aria-disabled", "true");
    showSettingsAnswer(forTheMaintainer(withCheck("checking")));
    await act(async () => answer({ kind: "checking", pick: 1 }));
    expect(channelStatus()).toHaveTextContent("Checking the channel…");
    expect(linkField()).toHaveValue(pickedLink);
    showSettingsAnswer(forTheMaintainer(pickedAgain(1, false)));
    expect(channelStatus()).toHaveTextContent("Picked #kudos-weekly.");
    expect(linkField()).toHaveValue("");
  });

  it("says it is checking, not the last pick's outcome, while the reply has come but the read hasn't moved yet", async () => {
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.picked), undefined, async () => ({ kind: "checking", pick: 2 }));

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    expect(channelStatus()).toHaveTextContent("Checking the channel…");
    showSettingsAnswer(forTheMaintainer(pickedAgain(2)));

    expect(channelStatus()).toHaveTextContent("Picked #kudos-weekly.");
    expect(linkField()).toHaveValue("");
  });

  it.each([
    ["answered", (later: { resolve: (reply: WeeklyPostChannelReply) => void }) => later.resolve({ kind: "checking", pick: 2 })],
    ["never answered", (later: { reject: (error: Error) => void }) => later.reject(new Error("no answer within the budget"))],
  ] as const)("says the channel is picked and empties the field when the read lands before the pick is %s", async (_, settle) => {
    const later = deferredReply();
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.picked), undefined, () => later.promise);

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    showSettingsAnswer(forTheMaintainer(pickedAgain(2)));
    await act(async () => settle(later));

    expect(channelStatus()).toHaveTextContent("Picked #kudos-weekly.");
    expect(linkField()).toHaveValue("");
  });

  it("keeps a second paste's refusal and its text when the first pick lands after it", async () => {
    const replies: WeeklyPostChannelReply[] = [{ kind: "checking", pick: 1 }, { kind: "refused", reason: "not-a-channel-link" }];
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, async () => replies.shift()!);

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    await user.clear(linkField());
    await user.type(linkField(), "#second-channel");
    await user.click(useThisChannel());
    showSettingsAnswer(forTheMaintainer(pickedAgain(1)));

    expect(channelStatus()).toHaveTextContent("That isn't a link to a Slack channel. Copy it from the channel in Slack.");
    expect(linkField()).toHaveValue("#second-channel");
  });

  it("says a second pick is still being checked when only the first one has landed", async () => {
    const replies: WeeklyPostChannelReply[] = [{ kind: "checking", pick: 1 }, { kind: "checking", pick: 2 }];
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, async () => replies.shift()!);

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    await user.clear(linkField());
    await user.type(linkField(), otherLink);
    await user.click(useThisChannel());
    showSettingsAnswer(forTheMaintainer(pickedAgain(1)));
    expect(channelStatus()).toHaveTextContent("Checking the channel…");
    expect(linkField()).toHaveValue(otherLink);
    showSettingsAnswer(forTheMaintainer({ ...weeklyPostParts.picked, channelPick: { picked: "other", check: "picked", pick: 2 } }));

    expect(channelStatus()).toHaveTextContent("Picked #other.");
    expect(linkField()).toHaveValue("");
  });

  it("keeps a link typed while the last pick was still being checked", async () => {
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, async () => ({ kind: "checking", pick: 1 }));

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    await user.clear(linkField());
    await user.type(linkField(), otherLink);
    showSettingsAnswer(forTheMaintainer(pickedAgain(1)));

    expect(channelStatus()).toHaveTextContent("Picked #kudos-weekly.");
    expect(linkField()).toHaveValue(otherLink);
  });

  it("shows no line for a pick's outcome stored before this page was opened", async () => {
    await showSettings(forTheMaintainer(withCheck("not-found", weeklyPostParts.picked)));

    expect(channelStatus()).toHaveTextContent("");
  });

  it.each([
    ["private", "That channel is private. I only post in public channels, since the post quotes public kudos."],
    ["shared", "That channel is shared with another organization. I only post in this workspace's own channels, since the post quotes kudos."],
    ["not-found", "I couldn't find that channel in this workspace. Check the link and try again."],
    ["archived", "That channel is archived. Pick another one."],
    ["failed", "Slack didn't answer about that channel. Try again."],
  ] as const)("says why the channel wasn't picked when its check reads %s, keeps the pasted link, and the post stays where it was", async (check, line) => {
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.picked), undefined, async () => ({ kind: "checking", pick: 2 }));

    await user.type(linkField(), otherLink);
    await user.click(useThisChannel());
    showSettingsAnswer(forTheMaintainer(withCheck(check, weeklyPostParts.picked)));

    expect(channelStatus()).toHaveTextContent(line);
    expect(linkField()).toHaveValue(otherLink);
    expect(weeklyPostSection()).toHaveTextContent("I post last week's top thoughtful kudos in #kudos-weekly.");
  });

  it("after an answer that never came, says what the read then shows about the pick", async () => {
    const { user, showSettingsAnswer } = await showSettings(forTheMaintainer(weeklyPostParts.unpicked), undefined, async () => {
      throw new Error("no answer within the budget");
    });

    await user.type(linkField(), pickedLink);
    await user.click(useThisChannel());
    expect(channelStatus()).toHaveTextContent("Couldn't reach HedgeHug. Try again.");
    showSettingsAnswer(forTheMaintainer(withCheck("checking")));
    expect(channelStatus()).toHaveTextContent("Checking the channel…");
    showSettingsAnswer(forTheMaintainer(pickedAgain(1)));

    expect(channelStatus()).toHaveTextContent("Picked #kudos-weekly.");
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

    expect(weeklyPostSection()).toHaveTextContent("I can't post in #kudos-weekly. Pick another channel below.");
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

function deferredReply() {
  let resolve: (reply: WeeklyPostChannelReply) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<WeeklyPostChannelReply>((settleWith, failWith) => {
    resolve = settleWith;
    reject = failWith;
  });
  return { promise, resolve, reject };
}
