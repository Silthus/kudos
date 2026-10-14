import type { ComponentType } from "react";
import { IconDay, IconLeave, IconLock, IconQuestion, IconUser } from "@posthog/icons";
import { CrateGlyph } from "../crates/CrateArt";
import { webPageOf } from "../features";
import { leaderboardHref, type Screen } from "../route";
import { navEntriesOf, type NavEntry } from "../nav/entries";
import type { FeatureCard, MemberProfile, Period } from "../shell";
import type { ThemeChoice } from "../theme";

export type Shell = { go: (href: string) => void; openCrate: (card: FeatureCard) => void; theme: ThemeChoice; chooseTheme: (choice: ThemeChoice) => void; signOut: () => void };

export type Printed = { tone: "said" | "refused" | "locked" | "unknown"; text: string };

export type Outcome = { kind: "close" } | { kind: "stay" } | { kind: "help" } | { kind: "print"; printed: Printed };

export type CommandState = "open" | "ready" | "locked";

export type Command = {
  name: string;
  aliases: string[];
  usage: string;
  blurb: string;
  Icon: ComponentType<{ className?: string }>;
  state: CommandState;
  run: (words: string[], shell: Shell, invokedAs: string) => Outcome;
};

export type Trap = { name: string; aliases: string[]; reply: (invokedAs: string) => Printed };

type PageCommand = { name: string; aliases: string[]; usage?: string; blurb?: string; hrefFor?: (words: string[]) => string };

const pageCommands: Record<Screen, PageCommand> = {
  home: { name: "profile", aliases: ["home", "me"], blurb: "Back to your profile." },
  quests: { name: "quests", aliases: [] },
  leaderboard: { name: "lb", aliases: ["leaderboard", "board"], usage: "lb [--week|--month|--all]", hrefFor: (words) => leaderboardHref(periodIn(words)) },
  book: { name: "book", aliases: ["achievements"] },
  skills: { name: "skills", aliases: ["perks", "tree"] },
};

const periodFlags: Period[] = ["week", "month", "all"];

function periodIn(words: string[]): Period {
  return periodFlags.find((period) => words.includes(`--${period}`)) ?? "week";
}

const close: Outcome = { kind: "close" };

const said = (text: string): Outcome => ({ kind: "print", printed: { tone: "said", text } });

const refused = (text: string): Outcome => ({ kind: "print", printed: { tone: "refused", text } });

const locked = (text: string): Outcome => ({ kind: "print", printed: { tone: "locked", text } });

export function commandsOf(member: MemberProfile): Command[] {
  return [...navEntriesOf(member).map((entry) => pageCommandOf(entry, member)), themeCommand, signOutCommand, helpCommand];
}

function pageCommandOf(entry: NavEntry, member: MemberProfile): Command {
  const screen = screenOf(entry);
  const { name, aliases, usage = name, blurb, hrefFor } = pageCommands[screen];
  if (entry.state === "open") {
    const page = entry.feature === undefined ? undefined : webPageOf(entry.feature);
    return { name, aliases, usage, blurb: blurb ?? page?.sentence ?? "", Icon: entry.Icon, state: "open", run: (words, shell) => (shell.go(hrefFor?.(words) ?? entry.href), close) };
  }
  if (entry.state === "ready") {
    return { name, aliases, usage, blurb: `${entry.name} is ready. Run it to open its crate.`, Icon: CrateGlyph, state: "ready", run: (_words, shell) => (shell.openCrate(entry.card), close) };
  }
  const level = member.progression?.level;
  const unlocks = `${entry.name} unlocks at level ${entry.level}.`;
  return { name, aliases, usage, blurb: `Locked. ${unlocks}`, Icon: IconLock, state: "locked", run: () => locked(level === undefined ? unlocks : `${unlocks} You're level ${level}.`) };
}

function screenOf(entry: NavEntry): Screen {
  if (entry.state === "open") return entry.screen;
  return webPageOf(entry.state === "ready" ? entry.card.feature : entry.feature)!.screen;
}

const themeNames: Record<ThemeChoice, { said: string; already: string }> = {
  light: { said: "Paper. Easy on the eyes.", already: "Already paper. Nothing to do." },
  dark: { said: "The void. Mind the glare.", already: "Already the void. Nothing to do." },
  system: { said: "Following your system setting.", already: "Already following your system setting." },
};

const themeCommand: Command = {
  name: "theme",
  aliases: ["dark", "light"],
  usage: "theme light|dark|system",
  blurb: "Paper, the void, or your system setting.",
  Icon: IconDay,
  state: "open",
  run: (words, shell, invokedAs) => {
    const wanted = invokedAs === "theme" ? words[0]?.toLowerCase() : invokedAs;
    if (!isThemeChoice(wanted)) return refused(`No theme called "${wanted ?? ""}". Try theme light, theme dark or theme system.`);
    if (wanted === shell.theme) return said(themeNames[wanted].already);
    shell.chooseTheme(wanted);
    return said(themeNames[wanted].said);
  },
};

function isThemeChoice(word: string | undefined): word is ThemeChoice {
  return word === "light" || word === "dark" || word === "system";
}

const signOutCommand: Command = { name: "signout", aliases: ["logout", "exit", "quit"], usage: "signout", blurb: "Sign out of HedgeHug.", Icon: IconLeave, state: "open", run: (_words, shell) => (shell.signOut(), close) };

const helpCommand: Command = { name: "help", aliases: ["--help", "-h", "man", "?"], usage: "help", blurb: "Every command, and the ones people keep trying.", Icon: IconQuestion, state: "open", run: () => ({ kind: "help" }) };

export const traps: Trap[] = [
  { name: "sudo", aliases: ["su"], reply: () => ({ tone: "refused", text: "sudo: nice try. Kudos are given in Slack, by humans." }) },
  { name: "give", aliases: ["kudos", "thank", "thanks"], reply: () => ({ tone: "said", text: "Kudos are given in Slack: mention a teammate in a message with the kudos emoji. This website is only the mirror." }) },
  { name: "rm", aliases: [], reply: () => ({ tone: "refused", text: "rm: refusing. You can't take back a thank-you." }) },
  { name: "respec", aliases: [], reply: () => ({ tone: "refused", text: "respec: command not found. Spent skill points never come back, and that's on purpose." }) },
  { name: "vim", aliases: ["vi", "emacs", "nano"], reply: (invokedAs) => ({ tone: "said", text: `${invokedAs}: this is a hedgehog, not an editor. :q works in your head only.` }) },
];

export function wordsOf(line: string) {
  const words = line.trim().replace(/^[>$]\s*/, "").split(/\s+/).filter(Boolean);
  return words[0]?.toLowerCase() === "hedgehug" ? words.slice(1) : words;
}

export function suggestionsFor(line: string, commands: Command[]): Command[] {
  const typed = wordsOf(line)[0]?.toLowerCase() ?? "";
  return commands.filter(({ name, aliases }) => [name, ...aliases].some((word) => word.startsWith(typed)));
}

export function run(line: string, commands: Command[], shell: Shell): Outcome {
  const [typedName, ...words] = wordsOf(line);
  if (typedName === undefined) return { kind: "stay" };
  const typed = typedName.toLowerCase();
  const exact = commands.find(({ name, aliases }) => name === typed || aliases.includes(typed));
  if (exact) return exact.run(words, shell, typed);
  const trap = traps.find(({ name, aliases }) => name === typed || aliases.includes(typed));
  if (trap) return { kind: "print", printed: trap.reply(typed) };
  const [onlyMatch, ...others] = suggestionsFor(typed, commands);
  if (onlyMatch !== undefined && others.length === 0) return onlyMatch.run(words, shell, onlyMatch.name);
  return { kind: "print", printed: { tone: "unknown", text: `No command "${line.trim()}". Type help to see them all.` } };
}
