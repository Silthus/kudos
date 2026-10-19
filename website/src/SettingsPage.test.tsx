import { act, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixedSettings, hugsRecap, settingsFixtures } from "./settingsFixtures";
import type { SettingsShown } from "./settingsRead";
import { shellFixtures, type GroupPickReply, type MessagePlace, type MessageSettingReply, type MySettings, type ShellActions, type VisibilityReply } from "./shell";
import { renderApp, renderSettingsPage } from "./test/renderApp";
import { fakeSystemTheme } from "./test/systemTheme";

beforeEach(() => {
  fakeSystemTheme(false);
  window.history.replaceState(null, "", "/settings");
});

function main() {
  return screen.getByRole("main");
}

type Commands = Partial<Pick<ShellActions, "setMessageSetting" | "pickPrimaryGroup" | "setBoardVisibility">>;

async function showSettings(settings: SettingsShown, commands: Commands = {}) {
  let shown = settings;
  const view = await renderSettingsPage((asking) => (asking ? shown : undefined), commands);
  const showSettingsAnswer = (next: SettingsShown) => {
    shown = next;
    view.showSettingsAgain();
  };
  return { ...view, showSettingsAnswer };
}

function answerLater<Reply>() {
  let resolve: (answer: Reply) => void = () => undefined;
  const answer = new Promise<Reply>((settle) => {
    resolve = settle;
  });
  return { answer, resolve };
}

function section(name: string) {
  return within(main()).getByRole("region", { name });
}

function placeChoice(label: string) {
  return within(section("Messages")).getByRole("radiogroup", { name: `Where I send you ${label}` });
}

function place(label: string, placeName: string) {
  return within(placeChoice(label)).getByRole("radio", { name: placeName });
}

function messageSwitch(label: string) {
  return within(section("Messages")).getByRole("switch", { name: label });
}

function status(name: string) {
  return within(section(name)).getByRole("status");
}

function rowStatus(label: string) {
  return within(within(section("Messages")).getByRole("group", { name: label })).getByRole("status");
}

function withPlace(settings: MySettings, kind: string, chosen: MessagePlace): MySettings {
  return { ...settings, messages: settings.messages!.map((setting) => (setting.kind === kind ? { ...setting, place: chosen, on: chosen !== "none" } : setting)) };
}

describe("SW10: /settings is a page of its own", () => {
  it("shows the Settings heading and its tab title", async () => {
    await showSettings(settingsFixtures.everything);

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(document.title).toBe("HedgeHug · Settings");
  });

  it("shows the not-found page when the read finds nothing to set", async () => {
    await showSettings({ kind: "not-found" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/not found|can't find|nothing/i);
  });

  it("asks a signed-out visitor to sign in, coming back to /settings", async () => {
    renderApp(shellFixtures.signedOut);

    expect(screen.getByRole("button", { name: /Sign in with Slack/ })).toBeInTheDocument();
  });
});

describe("Messages: where each message reaches the member", () => {
  it("lists every kind the read gives, in its order, with its label and description, and says what In the channel means", async () => {
    await showSettings(settingsFixtures.everything);

    const messages = section("Messages");
    expect(within(messages).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["After-kudos reply", "Level ups", "New features", "Public celebrations"]);
    expect(within(messages).getByText("When you reach a level, with what it opens for you.")).toBeInTheDocument();
    expect(within(messages).getByText(/In the channel means a message only you see, beside the kudos that caused it/)).toBeInTheDocument();
  });

  it("#580: draws a shortcode in a description as its emoji, and a custom one as a quiet chip", async () => {
    const recapWithBoth = { ...hugsRecap, description: hugsRecap.description.replace(":hedgehug:", ":hugging_face: and :hedgehug:").replace("Monday morning", "Monday at 09:30:00") };
    await showSettings({ ...settingsFixtures.everything, messages: [recapWithBoth] } as MySettings);

    const recap = within(section("Messages")).getByRole("group", { name: "Weekly hugs recap" });
    expect(recap).toHaveTextContent("Last week's hugs, the 🤗 and :hedgehug: you and your teammates reacted, with their XP, on Monday at 09:30:00.");
    expect(within(recap).getByText(":hedgehug:")).toHaveAttribute("data-custom-emoji");
    expect(recap.querySelectorAll("[data-custom-emoji]")).toHaveLength(1);
  });

  it("offers a kind with three places as one choice, checked from the read", async () => {
    await showSettings(settingsFixtures.everything);

    expect(within(placeChoice("Level ups")).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["As a DM", "In the channel", "None"]);
    expect(place("Level ups", "As a DM")).toBeChecked();
    expect(place("Level ups", "None")).not.toBeChecked();
  });

  it("offers a kind with two places as a switch, on while it isn't none", async () => {
    await showSettings(withPlace(settingsFixtures.everything, "new-features", "none"));

    expect(messageSwitch("New features")).not.toBeChecked();
    expect(messageSwitch("Public celebrations")).toBeChecked();
  });

  it("sends the chosen place once, and holds the row while the call is pending", async () => {
    const pending = answerLater<MessageSettingReply>();
    const setMessageSetting = vi.fn(() => pending.answer);
    const { user } = await showSettings(settingsFixtures.everything, { setMessageSetting });

    await user.click(place("Level ups", "In the channel"));

    expect(setMessageSetting).toHaveBeenCalledExactlyOnceWith("level-ups", "channel");
    expect(place("Level ups", "None")).toHaveAttribute("aria-disabled", "true");
    await user.click(place("Level ups", "None"));
    expect(setMessageSetting).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ kind: "set", place: "channel" }));
    expect(place("Level ups", "None")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("turns a two-place kind off with none and on with its other place", async () => {
    const setMessageSetting = vi.fn(async (_kind: string, chosen: MessagePlace) => ({ kind: "set", place: chosen }) as const);
    const { user, showSettingsAnswer } = await showSettings(settingsFixtures.everything, { setMessageSetting });

    await user.click(messageSwitch("New features"));
    expect(setMessageSetting).toHaveBeenLastCalledWith("new-features", "none");

    showSettingsAnswer(withPlace(settingsFixtures.everything, "new-features", "none"));
    await user.click(messageSwitch("New features"));
    expect(setMessageSetting).toHaveBeenLastCalledWith("new-features", "dm");
  });

  it("keeps its position from the read, never from the place sent, and says where it lands once the read moves", async () => {
    const { user, showSettingsAnswer } = await showSettings(settingsFixtures.everything, { setMessageSetting: async () => ({ kind: "set", place: "none" }) });

    await user.click(place("Level ups", "None"));
    await act(async () => undefined);
    expect(place("Level ups", "As a DM")).toBeChecked();

    showSettingsAnswer(withPlace(settingsFixtures.everything, "level-ups", "none"));
    expect(place("Level ups", "None")).toBeChecked();
    expect(rowStatus("Level ups")).toHaveTextContent("Level ups: off.");
  });

  it.each([
    { reply: async () => ({ kind: "refused" }) as const, line: "That couldn't be changed." },
    { reply: async () => Promise.reject(new Error("offline")), line: "Couldn't reach HedgeHug. Try again." },
  ])("says $line when the change doesn't land", async ({ reply, line }) => {
    const { user } = await showSettings(settingsFixtures.everything, { setMessageSetting: reply });

    await user.click(place("Level ups", "None"));

    expect(rowStatus("Level ups")).toHaveTextContent(line);
    expect(place("Level ups", "As a DM")).toBeChecked();
  });

  it("forgets a refusal once another tab moves the read, so it never comes back", async () => {
    const { user, showSettingsAnswer } = await showSettings(settingsFixtures.everything, { setMessageSetting: async () => ({ kind: "refused" }) });

    await user.click(place("Level ups", "None"));
    expect(rowStatus("Level ups")).toHaveTextContent("That couldn't be changed.");

    showSettingsAnswer(withPlace(settingsFixtures.everything, "level-ups", "none"));
    showSettingsAnswer(withPlace(settingsFixtures.everything, "level-ups", "channel"));

    expect(rowStatus("Level ups")).toBeEmptyDOMElement();
  });

  it("leaves Messages out while the read has none", async () => {
    await showSettings({ ...settingsFixtures.everything, messages: null });

    expect(within(main()).queryByRole("region", { name: "Messages" })).not.toBeInTheDocument();
  });
});

describe("Leaderboards: the visibility switch lives on /settings too", () => {
  it("is checked from the read and sends the flipped setting", async () => {
    const setBoardVisibility = vi.fn(async (visible: boolean): Promise<VisibilityReply> => ({ kind: "set", visible }));
    const { user } = await showSettings(settingsFixtures.everything, { setBoardVisibility });

    const visibility = within(section("Leaderboards")).getByRole("switch", { name: "Show me on the leaderboards" });
    expect(visibility).toBeChecked();
    await user.click(visibility);

    expect(setBoardVisibility).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("leaves Leaderboards out while the board isn't open", async () => {
    await showSettings({ ...settingsFixtures.everything, board: null });

    expect(within(main()).queryByRole("region", { name: "Leaderboards" })).not.toBeInTheDocument();
  });
});

describe("Your group: the group the member counts for", () => {
  function groupPicker() {
    return within(section("Your group")).getByRole("combobox", { name: "The group you count for" });
  }

  it("picks from the member's groups, the primary one selected", async () => {
    await showSettings(settingsFixtures.everything);

    expect(within(groupPicker()).getAllByRole("option").map((option) => option.textContent)).toEqual(["Gardeners", "Zebras"]);
    expect(groupPicker()).toHaveValue("g_zebras");
  });

  it("sends the pick once, held while pending, and says which group the member counts for after the read moves", async () => {
    const pending = answerLater<GroupPickReply>();
    const pickPrimaryGroup = vi.fn(() => pending.answer);
    const { user, showSettingsAnswer } = await showSettings(settingsFixtures.everything, { pickPrimaryGroup });

    await user.selectOptions(groupPicker(), "Gardeners");

    expect(pickPrimaryGroup).toHaveBeenCalledExactlyOnceWith("g_gardeners");
    expect(groupPicker()).toBeDisabled();
    expect(groupPicker()).toHaveValue("g_zebras");

    await act(async () => pending.resolve({ kind: "picked", group: "g_gardeners" }));
    const group = settingsFixtures.everything.group!;
    showSettingsAnswer({ ...settingsFixtures.everything, group: { ...group, primary: group.groups[0]! } });

    expect(groupPicker()).toHaveValue("g_gardeners");
    expect(groupPicker()).toBeEnabled();
    expect(status("Your group")).toHaveTextContent("You count for Gardeners.");
  });

  it("says That couldn't be changed. when the pick is refused", async () => {
    const { user } = await showSettings(settingsFixtures.everything, { pickPrimaryGroup: async () => ({ kind: "refused" }) });

    await user.selectOptions(groupPicker(), "Gardeners");

    expect(status("Your group")).toHaveTextContent("That couldn't be changed.");
    expect(groupPicker()).toHaveValue("g_zebras");
  });
});

describe("WS24: /settings passes axe in light and dark", () => {
  const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

  for (const dark of [false, true]) {
    it(`with every section, after a refusal, in ${dark ? "dark" : "light"}`, async () => {
      fakeSystemTheme(dark);
      const { container, user } = await showSettings(fixedSettings(settingsFixtures.everything)(true)!, { setMessageSetting: async () => ({ kind: "refused" }) });
      await user.click(place("Level ups", "None"));
      rowStatus("Level ups");

      const results = await axe.run(container, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    }, 30_000);
  }
});
