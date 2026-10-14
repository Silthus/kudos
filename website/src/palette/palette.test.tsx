import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellFixtures, type FeatureCard, type MemberProfile } from "../shell";
import { renderApp } from "../test/renderApp";
import { fakeSystemTheme } from "../test/systemTheme";

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  fakeSystemTheme(false);
});

const card = (feature: FeatureCard["feature"], name: string, level: number, state: FeatureCard["state"]): FeatureCard => ({
  feature,
  name,
  opens: "the boards",
  level,
  seen: `seen-${feature}`,
  state,
  readyAt: state === "locked" ? null : Date.parse("2026-10-12T09:00:00Z"),
  openedAt: state === "open" ? Date.parse("2026-10-13T09:00:00Z") : null,
});

const onTheUnlockPath = (...features: FeatureCard[]): MemberProfile => ({
  ...shellFixtures.memberAtLevel7,
  features,
  leaderboard: { kind: features.some(({ feature, state }) => feature === "leaderboard" && state === "open") ? "open" : "off" },
});

const everyPageOpen = onTheUnlockPath(card("quests", "Quests", 2, "open"), card("leaderboard", "Leaderboard", 3, "open"), card("book", "Book", 4, "open"), card("skillTree", "Skill tree", 5, "open"));

const everyState = onTheUnlockPath(card("quests", "Quests", 2, "open"), card("leaderboard", "Leaderboard", 3, "ready"), card("book", "Book", 8, "locked"), card("skillTree", "Skill tree", 9, "locked"));

const palette = () => screen.getByRole("dialog", { name: "Command palette" });

const commandField = () => within(palette()).getByRole("combobox", { name: "Command" });

const printed = () => within(palette()).getByRole("status");

async function run(user: ReturnType<typeof renderApp>["user"], line: string) {
  await user.keyboard("{Control>}k{/Control}");
  await user.type(commandField(), `${line}{Enter}`);
}

describe("WS305: Ctrl K or the dashed chip toggles the palette", () => {
  it("opens on Ctrl K with focus in the Command field, and Esc closes it and returns focus to where it was", async () => {
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureOpen);
    const theme = screen.getByRole("button", { name: "Light" });
    theme.focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(palette()).toHaveAttribute("aria-modal", "true");
    expect(commandField()).toHaveFocus();
    expect(commandField().closest("label")).toHaveTextContent("Esc");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(theme).toHaveFocus();
  });

  it("opens from the dashed chip, which shows the shortcut, and closes on Ctrl K pressed inside it, giving focus back to the chip", async () => {
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureOpen);
    const chip = screen.getByRole("button", { name: "Open the command palette" });
    expect(chip).toHaveTextContent("Ctrl K");
    expect(chip).toHaveClass("hidden", "sm:inline-flex", "border-dashed");
    await user.click(chip);
    expect(commandField()).toHaveFocus();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(chip).toHaveFocus();
  });

  it("keeps focus in the field on Tab and Shift Tab, and makes the page behind it inert", async () => {
    const { user } = renderApp(everyPageOpen);
    await run(user, "zzz");
    await user.keyboard("{Tab}");
    expect(commandField()).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(commandField()).toHaveFocus();
    expect(screen.getByRole("banner", { hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("closes when the backdrop is clicked", async () => {
    const { user } = renderApp(everyPageOpen);
    await user.keyboard("{Control>}k{/Control}");
    await user.click(document.querySelector("[data-palette-backdrop]")!);
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("shows ⌘K and answers ⌘ K on Apple platforms", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureOpen);
    expect(screen.getByRole("button", { name: "Open the command palette" })).toHaveTextContent("⌘K");
    await user.keyboard("{Meta>}k{/Meta}");
    expect(commandField()).toHaveFocus();
  });

  it("leaves Ctrl K alone while focus is in another text field", async () => {
    const { user } = renderApp(shellFixtures.memberWithEveryFeatureOpen);
    const elsewhere = document.body.appendChild(document.createElement("input"));
    elsewhere.setAttribute("aria-label", "Somewhere else");
    elsewhere.focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it("has no palette for a visitor who isn't a member", async () => {
    const { user } = renderApp(shellFixtures.notAMember);
    expect(screen.queryByRole("button", { name: "Open the command palette" })).not.toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });
});

describe("WS306: a page command follows its nav entry", () => {
  it.each([
    ["profile", "/"],
    ["home", "/"],
    ["me", "/"],
    ["quests", "/quests"],
    ["lb", "/leaderboard"],
    ["leaderboard --month", "/leaderboard?period=month"],
    ["board --all", "/leaderboard?period=all"],
    ["lb --week", "/leaderboard"],
    ["book", "/book"],
    ["achievements", "/book"],
    ["skills", "/skills"],
    ["perks", "/skills"],
    ["tree", "/skills"],
  ])("%s goes to %s and closes the palette when the page is open", async (line, address) => {
    window.history.replaceState(null, "", "/quests?quest=2");
    const { user } = renderApp(everyPageOpen);
    await run(user, line);
    expect(window.location.pathname + window.location.search).toBe(address);
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });

  it("moves focus to the new page's title, as a nav link does", async () => {
    window.history.replaceState(null, "", "/nowhere");
    const { user } = renderApp(everyPageOpen);
    screen.getByRole("button", { name: "Open the command palette" }).focus();
    await run(user, "me");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("opens a ready feature's crate, as its nav entry does", async () => {
    const openFeature = vi.fn(async () => ({ kind: "opened" }) as const);
    const { user } = renderApp(everyState, undefined, { openFeature });
    await run(user, "board --month");
    expect(openFeature).toHaveBeenCalledExactlyOnceWith("leaderboard");
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Level 3 unlock");
    expect(window.location.pathname).toBe("/");
  });

  it("says when a locked feature unlocks, and stays open on the same page", async () => {
    const { user } = renderApp(everyState);
    await run(user, "achievements");
    expect(printed()).toHaveTextContent("Book unlocks at level 8. You're level 7.");
    expect(commandField()).toHaveFocus();
    expect(commandField()).toHaveValue("");
    expect(window.location.pathname).toBe("/");
  });

  it.each(["quests", "lb", "book", "skills"])("treats %s as unknown when its feature hasn't shipped", async (line) => {
    const { user } = renderApp(shellFixtures.memberWithNothingShipped);
    await run(user, line);
    expect(printed()).toHaveTextContent(`No command "${line}". Type help to see them all.`);
    expect(window.location.pathname).toBe("/");
  });
});

const options = () => within(palette()).getAllByRole("option");

const optionNames = () => options().map((option) => option.querySelector(".font-mono")?.textContent);

describe("WS306: suggestions, keys, help and the unknown command", () => {
  it("suggests the matching commands as the member types, each with its usage, blurb and aliases", async () => {
    const { user } = renderApp(everyState);
    await user.keyboard("{Control>}k{/Control}");
    expect(optionNames()).toEqual(["profile", "quests", "lb [--week|--month|--all]", "book", "skills", "theme light|dark|system", "signout", "help"]);
    await user.type(commandField(), "b");
    expect(optionNames()).toEqual(["lb [--week|--month|--all]", "book"]);
    const [board, book] = options();
    expect(board).toHaveTextContent("Leaderboard is ready. Run it to open its crate.");
    expect(board).toHaveTextContent("leaderboard · board");
    expect(book).toHaveTextContent("Locked. Book unlocks at level 8.");
    expect(book).toHaveTextContent("achievements");
  });

  it("moves the selection with Up and Down through aria-activedescendant, completes it with Tab and runs it with Enter", async () => {
    const { user } = renderApp(everyPageOpen);
    await user.keyboard("{Control>}k{/Control}");
    await user.type(commandField(), "l");
    expect(commandField()).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    const first = options()[0]!;
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(commandField()).toHaveAttribute("aria-activedescendant", first.id);
    expect(commandField()).toHaveAttribute("aria-controls", within(palette()).getByRole("listbox").id);
    await user.keyboard("{ArrowUp}");
    expect(commandField()).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Tab}");
    expect(commandField()).toHaveValue("lb ");
    expect(commandField()).toHaveFocus();
    await user.type(commandField(), "--month{Enter}");
    expect(window.location.pathname + window.location.search).toBe("/leaderboard?period=month");
  });

  it("runs the only command a prefix matches", async () => {
    const { user } = renderApp(everyPageOpen);
    await run(user, "que");
    expect(window.location.pathname).toBe("/quests");
  });

  it("lists every command the member can run under help, with the keys in the footer, and Esc goes back", async () => {
    const { user } = renderApp(everyState);
    await run(user, "help");
    expect(within(palette()).getByRole("listbox", { name: "Every command" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["profile", "quests", "lb [--week|--month|--all]", "book", "skills", "theme light|dark|system", "signout", "help"]);
    expect(within(palette()).getByRole("list", { name: "Not commands, but people keep trying" })).toHaveTextContent("sudogivermrespecvim");
    expect(within(palette()).getByRole("contentinfo")).toHaveTextContent("↑↓ select · Tab complete · ↵ run · Esc close");
    await user.keyboard("{Escape}");
    expect(within(palette()).getByRole("listbox", { name: "Commands" })).toBeInTheDocument();
    expect(commandField()).toHaveFocus();
  });

  it("shows Max with the unknown command, and keeps the palette open", async () => {
    const { user } = renderApp(everyPageOpen);
    await run(user, "coins --all");
    expect(printed()).toHaveTextContent('No command "coins --all". Type help to see them all.');
    expect(printed().querySelector("svg")).toBeInTheDocument();
    expect(commandField()).toHaveFocus();
  });
});

describe("WS306: the shell commands", () => {
  it.each([
    ["theme dark", "The void. Mind the glare.", "Dark", true],
    ["dark", "The void. Mind the glare.", "Dark", true],
    ["theme light", "Already paper. Nothing to do.", "Light", false],
    ["theme system", "Following your system setting.", "Use system setting", false],
  ] as const)("%s says %s and moves the header's theme control with it", async (line, says, pressed, dark) => {
    localStorage.setItem("hedgehug.theme", "light");
    const { user } = renderApp(everyPageOpen);
    await run(user, line);
    expect(printed()).toHaveTextContent(says);
    expect(document.documentElement.classList.contains("dark")).toBe(dark);
    expect(screen.getByRole("button", { name: pressed, hidden: true })).toHaveAttribute("aria-pressed", "true");
  });

  it("refuses a theme it doesn't have", async () => {
    const { user } = renderApp(everyPageOpen);
    await run(user, "theme sepia");
    expect(printed()).toHaveTextContent('No theme called "sepia". Try theme light, theme dark or theme system.');
  });

  it.each(["signout", "logout"])("%s signs the member out", async (line) => {
    const { user, actions } = renderApp(everyPageOpen);
    await run(user, line);
    expect(actions.signOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
  });
});

describe("WS307: the playful replies that are still true", () => {
  it.each([
    ["sudo", "sudo: nice try. Kudos are given in Slack, by humans."],
    ["thanks", "Kudos are given in Slack: mention a teammate in a message with the kudos emoji. This website is only the mirror."],
    ["rm", "rm: refusing. You can't take back a thank-you."],
    ["respec", "respec: command not found. Spent skill points never come back, and that's on purpose."],
    ["emacs", "emacs: this is a hedgehog, not an editor. :q works in your head only."],
  ])("%s answers without reading or writing anything", async (line, says) => {
    const { user, actions } = renderApp(everyPageOpen);
    await run(user, line);
    expect(printed()).toHaveTextContent(says);
    expect(window.location.pathname).toBe("/");
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });

  it.each(["ls", "cd", "stickers", "inventory", "collection"])("drops %s, whose copy names an unshipped page or isn't true everywhere", async (line) => {
    const { user } = renderApp(everyPageOpen);
    await run(user, line);
    expect(printed()).toHaveTextContent(`No command "${line}". Type help to see them all.`);
  });
});

const wcag22AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations() {
  const results = await axe.run(document.body, { runOnly: { type: "tag", values: wcag22AA }, rules: { "color-contrast": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

describe("WS308: the palette passes axe in light and dark", () => {
  const states: [string, (user: ReturnType<typeof renderApp>["user"]) => Promise<void>][] = [
    ["suggesting, with a locked command selected", async (user) => {
      await user.keyboard("{Control>}k{/Control}");
      await user.type(commandField(), "bo{ArrowDown}{ArrowDown}");
    }],
    ["listing help", (user) => run(user, "help")],
    ["printing a locked feature's level", (user) => run(user, "book")],
    ["showing Max for an unknown command", (user) => run(user, "coins")],
    ["matching nothing as the member types", async (user) => {
      await user.keyboard("{Control>}k{/Control}");
      await user.type(commandField(), "zzz");
    }],
  ];
  for (const dark of [false, true]) {
    it.each(states)(`%s in ${dark ? "dark" : "light"}`, async (_, reach) => {
      fakeSystemTheme(dark);
      const { user } = renderApp(everyState);
      await reach(user);
      expect(await violations()).toEqual([]);
    });
  }

  it("speaks what a command printed through a polite status line that is there before anything is printed", async () => {
    const { user } = renderApp(everyState);
    await user.keyboard("{Control>}k{/Control}");
    expect(printed()).toBeEmptyDOMElement();
    await user.type(commandField(), "book{Enter}");
    expect(printed()).toHaveTextContent("> book");
    expect(printed()).toHaveTextContent("Book unlocks at level 8. You're level 7.");
  });
});
