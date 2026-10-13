// Variant E command registry for the Cmd/Ctrl-K palette, adapted from D: commands navigate, a few are witty traps, a locked screen answers with its unlock level and a ready one opens its crate.
import type { ComponentType } from "react";
import { IconBook, IconBox, IconDay, IconLeave, IconListTree, IconPalette, IconQuestion, IconRibbon, IconStar, IconUser } from "@posthog/icons";
import type { ScreenId } from "../../nav";
import { featureStateAt, showCrate, unlockOf, type Feature, type FeatureState } from "./unlocks";

export type Shell = { go: (screen: ScreenId, param?: string) => void; dark: boolean; level: number; toggleTheme: () => void; openHelp: () => void; signOut: () => void };

export type Output = { tone: "ok" | "error"; text: string };

export type Outcome = { kind: "close" } | { kind: "stay"; output?: Output };

export type Command = {
  name: string;
  aliases: string[];
  usage: string;
  blurb: string;
  Icon?: ComponentType<{ className?: string }>;
  hidden?: boolean;
  feature?: Feature;
  run: (args: string[], shell: Shell, invokedAs: string) => Outcome;
};

const flagsOf = (args: string[]) => args.filter((a) => a.startsWith("--")).map((a) => a.slice(2));
const wordsOf = (args: string[]) => args.filter((a) => !a.startsWith("--"));
const pick = (flags: string[], known: string[]) => flags.find((f) => known.includes(f));

const close: Outcome = { kind: "close" };
const ok = (text: string): Outcome => ({ kind: "stay", output: { tone: "ok", text } });
const error = (text: string): Outcome => ({ kind: "stay", output: { tone: "error", text } });
const goTo = (shell: Shell, screen: ScreenId, param?: string): Outcome => {
  shell.go(screen, param);
  return close;
};

export const commands: Command[] = [
  { name: "profile", aliases: ["whoami", "me", "home", "gear", "loadout", "equip"], usage: "profile", blurb: "Your character sheet and gear", Icon: IconUser, run: (_args, shell) => goTo(shell, "profile") },
  { name: "inventory", aliases: ["bag", "titles", "quips", "emoji", "cosmetics"], usage: "inventory", blurb: "Titles, quips and emoji, owned and not yet", Icon: IconBox, feature: "gear", run: (_args, shell) => goTo(shell, "profile", "inventory") },
  { name: "skills", aliases: ["perks", "tree"], usage: "skills [perk]", blurb: "21 perks, 9 branches, zero refunds", Icon: IconListTree, feature: "skills", run: (args, shell) => goTo(shell, "skills", wordsOf(args)[0]?.toLowerCase()) },
  {
    name: "lb",
    aliases: ["leaderboard", "top"],
    usage: "lb [--week|--month|--all]",
    blurb: "Who said thanks the most. Kudos given only",
    Icon: IconStar,
    run: (args, shell) => {
      const flags = flagsOf(args);
      const parts = [pick(flags, ["groups", "my-group", "everyone"]), pick(flags, ["week", "month", "all"])].filter((p): p is string => Boolean(p));
      return goTo(shell, "leaderboard", parts.length > 0 ? parts.join(".") : undefined);
    },
  },
  { name: "stickers", aliases: ["album"], usage: "stickers", blurb: "The faces you've thanked", Icon: IconBook, feature: "book", run: (_args, shell) => goTo(shell, "stickers") },
  { name: "achievements", aliases: ["ladders"], usage: "achievements", blurb: "12 ladders, 4 tiers. Tiers are not rarities", Icon: IconRibbon, feature: "book", run: (_args, shell) => goTo(shell, "achievements") },
  { name: "collection", aliases: ["hogs", "hedgehogs", "shelf", "store"], usage: "collection", blurb: "Every hedgehog, owned or not", Icon: IconPalette, feature: "collection", run: (_args, shell) => goTo(shell, "collection") },
  {
    name: "theme",
    aliases: ["dark", "light"],
    usage: "theme [dark|light]",
    blurb: "Flip between paper and the void",
    Icon: IconDay,
    run: (args, shell, invokedAs) => {
      const wanted = invokedAs === "theme" ? wordsOf(args)[0] : invokedAs;
      if (wanted && wanted !== "dark" && wanted !== "light") return error(`No such theme as '${wanted}'. There's paper (light) and the void (dark).`);
      const target = wanted ?? (shell.dark ? "light" : "dark");
      if ((target === "dark") === shell.dark) return ok(`Already ${target === "dark" ? "the void" : "paper"}. Nothing to do.`);
      shell.toggleTheme();
      return ok(target === "dark" ? "The void. Mind the glare." : "Paper. Easy on the eyes.");
    },
  },
  {
    name: "help",
    aliases: ["--help", "-h", "man", "?"],
    usage: "help",
    blurb: "Every command, and the ones people keep trying",
    Icon: IconQuestion,
    run: (_args, shell) => {
      shell.openHelp();
      return { kind: "stay" };
    },
  },
  { name: "exit", aliases: ["logout", "quit"], usage: "exit", blurb: "Sign out. The hog waves goodbye", Icon: IconLeave, run: (_args, shell) => (shell.signOut(), close) },
  { name: "respec", aliases: [], usage: "respec", blurb: "Spent skill points never come back", hidden: true, run: () => error("respec: command not found. Spent skill points never come back, and that's on purpose.") },
  { name: "sudo", aliases: ["su"], usage: "sudo", blurb: "Kudos are given in Slack, by humans", hidden: true, run: () => error("sudo: nice try. Kudos are given in Slack, by humans.") },
  { name: "give", aliases: ["kudos", "thank", "thanks"], usage: "give", blurb: "This is only the mirror", hidden: true, run: () => ok("Kudos are given in Slack: react with the kudos emoji on a teammate's message. This website is only the mirror.") },
  { name: "rm", aliases: [], usage: "rm", blurb: "You can't take back a thank-you", hidden: true, run: () => error("rm: refusing. You can't take back a thank-you.") },
  { name: "ls", aliases: ["dir"], usage: "ls", blurb: "Lists the screens", hidden: true, run: () => ok("profile  inventory  skills  stickers  achievements  collection  lb") },
  { name: "cd", aliases: [], usage: "cd", blurb: "There is only home", hidden: true, run: () => ok("cd: you're already home.") },
  { name: "vim", aliases: ["vi", "emacs", "nano"], usage: "vim", blurb: "Not an editor", hidden: true, run: (_args, _shell, invokedAs) => ok(`${invokedAs}: this is a hedgehog, not an editor. :q works in your head only.`) },
];

export const stateOf = (command: Command, level: number): FeatureState => (command.feature ? featureStateAt(command.feature, level) : "unlocked");

const lockedAnswer = (command: Command, level: number): Outcome => {
  const unlock = unlockOf(command.feature!);
  return error(`${command.name}: locked. ${unlock.name} unlocks at level ${unlock.level}, and you're level ${level}.`);
};

export const visibleCommands = commands.filter((c) => !c.hidden);
export const hiddenCommands = commands.filter((c) => c.hidden);

export const tokensOf = (line: string) => {
  const tokens = line.trim().replace(/^[>$]\s*/, "").split(/\s+/).filter(Boolean);
  return tokens[0]?.toLowerCase() === "hedgehug" ? tokens.slice(1) : tokens;
};

const find = (name: string) => commands.find((c) => c.name === name || c.aliases.includes(name));

const onlyMatch = (prefix: string) => {
  const matches = suggest(prefix);
  return matches.length === 1 ? matches[0] : undefined;
};

export function run(line: string, shell: Shell): Outcome {
  const [name, ...args] = tokensOf(line);
  if (!name) return { kind: "stay" };
  const typed = name.toLowerCase();
  const exact = find(typed);
  const command = exact ?? onlyMatch(typed);
  if (!command) return error(`Nothing called '${name}'. Try help.`);
  const state = stateOf(command, shell.level);
  if (state === "locked") return lockedAnswer(command, shell.level);
  if (state === "ready") return (showCrate(command.feature!), close);
  return command.run(args, shell, exact ? typed : command.name);
}

export function suggest(line: string): Command[] {
  const [first = ""] = tokensOf(line);
  const prefix = first.toLowerCase();
  if (!prefix) return visibleCommands;
  return visibleCommands.filter((c) => c.name.startsWith(prefix) || c.aliases.some((a) => a.startsWith(prefix)));
}
