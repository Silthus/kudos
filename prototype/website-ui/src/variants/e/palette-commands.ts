// Variant E command registry for the Cmd/Ctrl-K palette, adapted from D: commands navigate, a few are witty traps.
import type { ComponentType } from "react";
import { IconBook, IconDay, IconLeave, IconListTree, IconPalette, IconQuestion, IconRibbon, IconStar, IconUser } from "@posthog/icons";
import type { ScreenId } from "../../nav";

export type Shell = { go: (screen: ScreenId, param?: string) => void; dark: boolean; toggleTheme: () => void; openHelp: () => void; signOut: () => void };

export type Output = { tone: "ok" | "error"; text: string };

export type Outcome = { kind: "close" } | { kind: "stay"; output?: Output };

export type Command = {
  name: string;
  aliases: string[];
  usage: string;
  blurb: string;
  Icon?: ComponentType<{ className?: string }>;
  hidden?: boolean;
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
  { name: "profile", aliases: ["whoami", "me", "home", "gear", "loadout", "equip", "inventory"], usage: "profile", blurb: "Your character sheet and gear", Icon: IconUser, run: (_args, shell) => goTo(shell, "profile") },
  { name: "skills", aliases: ["perks", "tree"], usage: "skills [perk]", blurb: "21 perks, 9 branches, zero refunds", Icon: IconListTree, run: (args, shell) => goTo(shell, "skills", wordsOf(args)[0]?.toLowerCase()) },
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
  { name: "stickers", aliases: ["album"], usage: "stickers", blurb: "The faces you've thanked", Icon: IconBook, run: (_args, shell) => goTo(shell, "stickers") },
  { name: "achievements", aliases: ["ladders"], usage: "achievements", blurb: "12 ladders, 4 tiers. Tiers are not rarities", Icon: IconRibbon, run: (_args, shell) => goTo(shell, "achievements") },
  { name: "collection", aliases: ["hogs", "hedgehogs", "cosmetics", "store"], usage: "collection", blurb: "Hedgehogs, titles, quips and emoji", Icon: IconPalette, run: (_args, shell) => goTo(shell, "collection") },
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
  { name: "ls", aliases: ["dir"], usage: "ls", blurb: "Lists the screens", hidden: true, run: () => ok("profile  skills  stickers  achievements  collection  lb") },
  { name: "cd", aliases: [], usage: "cd", blurb: "There is only home", hidden: true, run: () => ok("cd: you're already home.") },
  { name: "vim", aliases: ["vi", "emacs", "nano"], usage: "vim", blurb: "Not an editor", hidden: true, run: (_args, _shell, invokedAs) => ok(`${invokedAs}: this is a hedgehog, not an editor. :q works in your head only.`) },
];

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
  return command.run(args, shell, exact ? typed : command.name);
}

export function suggest(line: string): Command[] {
  const [first = ""] = tokensOf(line);
  const prefix = first.toLowerCase();
  if (!prefix) return visibleCommands;
  return visibleCommands.filter((c) => c.name.startsWith(prefix) || c.aliases.some((a) => a.startsWith(prefix)));
}
