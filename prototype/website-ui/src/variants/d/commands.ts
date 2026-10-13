// PROTOTYPE command registry for the D variant: what the prompt, the palette and --help understand.
import type { ScreenId } from "../../nav";

export type Shell = { go: (screen: ScreenId, param?: string) => void; dark: boolean; toggleTheme: () => void; openHelp: () => void; clear: () => void; signOut: () => void };

export type Output = { tone: "ok" | "error"; text: string };

export type Command = { name: string; aliases: string[]; usage: string; blurb: string; hidden?: boolean; run: (args: string[], shell: Shell, invokedAs: string) => Output | undefined };

export const redesigned: ScreenId[] = ["profile", "skills", "leaderboard"];

export const windows: Record<ScreenId, string> = { profile: "profile", skills: "perks", stickers: "stickers", achievements: "achievements", collection: "collection", leaderboard: "leaderboard", landing: "motd" };

export const screenCommand = (screen: ScreenId) => ({ profile: "hedgehug profile", skills: "hedgehug perks --tree", leaderboard: "hedgehug leaderboard --week --everyone", stickers: "hedgehug stickers", achievements: "hedgehug achievements", collection: "hedgehug collection", landing: "hedgehug motd" })[screen];

const flagsOf = (args: string[]) => args.filter((a) => a.startsWith("--")).map((a) => a.slice(2));
const wordsOf = (args: string[]) => args.filter((a) => !a.startsWith("--"));
const pick = (flags: string[], known: string[]) => flags.find((f) => known.includes(f));

const ok = (text: string): Output => ({ tone: "ok", text });
const error = (text: string): Output => ({ tone: "error", text });

export const commands: Command[] = [
  { name: "profile", aliases: ["whoami", "me", "home"], usage: "profile", blurb: "who you are, in numbers only you can see", run: (_args, shell) => void shell.go("profile") },
  { name: "perks", aliases: ["skills", "tree"], usage: "perks --tree [<perk>]", blurb: "21 perks, 9 branches, zero refunds", run: (args, shell) => void shell.go("skills", wordsOf(args)[0]?.toLowerCase()) },
  {
    name: "leaderboard",
    aliases: ["lb", "top"],
    usage: "leaderboard [--week|--month|--all] [--groups|--my-group|--everyone]",
    blurb: "who said thanks the most. kudos given only; XP never ranks",
    run: (args, shell) => {
      const flags = flagsOf(args);
      const parts = [pick(flags, ["groups", "my-group", "everyone"]), pick(flags, ["week", "month", "all"])].filter((p): p is string => Boolean(p));
      shell.go("leaderboard", parts.length > 0 ? parts.join(".") : undefined);
      return undefined;
    },
  },
  { name: "stickers", aliases: ["album"], usage: "stickers", blurb: "the faces you've thanked, and who thanked you back", run: (_args, shell) => void shell.go("stickers") },
  { name: "achievements", aliases: ["ladders"], usage: "achievements", blurb: "12 ladders, 4 tiers. tiers are not rarities (we checked)", run: (_args, shell) => void shell.go("achievements") },
  { name: "collection", aliases: ["cosmetics", "loadout"], usage: "collection", blurb: "cards, titles, quips and emoji, in their rarity colours", run: (_args, shell) => void shell.go("collection") },
  {
    name: "theme",
    aliases: ["dark", "light"],
    usage: "theme [dark|light]",
    blurb: "flip between paper and the void",
    run: (args, shell, invokedAs) => {
      const wanted = invokedAs === "theme" ? wordsOf(args)[0] : invokedAs;
      if (wanted && wanted !== "dark" && wanted !== "light") return error(`theme: no such theme '${wanted}'. there's paper (light) and the void (dark).`);
      const target = wanted ?? (shell.dark ? "light" : "dark");
      if ((target === "dark") === shell.dark) return ok(`theme: already ${target === "dark" ? "the void" : "paper"}. nothing to do.`);
      shell.toggleTheme();
      return ok(target === "dark" ? "theme: the void. mind the glare." : "theme: paper. easy on the eyes.");
    },
  },
  { name: "help", aliases: ["--help", "-h", "man", "?"], usage: "help", blurb: "you are here", run: (_args, shell) => void shell.openHelp() },
  { name: "clear", aliases: ["cls"], usage: "clear", blurb: "tidies up, like a good teammate", run: (_args, shell) => void shell.clear() },
  { name: "exit", aliases: ["logout", "quit"], usage: "exit", blurb: "sign out. the hog waves goodbye", run: (_args, shell) => void shell.signOut() },
  { name: "respec", aliases: [], usage: "respec", blurb: "spent skill points never come back. no respec.", hidden: true, run: () => error("respec: command not found. spent skill points never come back, and that's on purpose.") },
  { name: "sudo", aliases: ["su"], usage: "sudo", blurb: "nice try. kudos are given in Slack, by humans.", hidden: true, run: () => error("sudo: nice try. kudos are given in Slack, by humans.") },
  { name: "give", aliases: ["kudos", "thank", "thanks"], usage: "give", blurb: "this is only the mirror", hidden: true, run: () => ok("kudos are given in Slack: react with the kudos emoji on a teammate's message. this website is only the mirror.") },
  { name: "rm", aliases: [], usage: "rm", blurb: "you can't take back a thank-you", hidden: true, run: () => error("rm: refusing. you can't take back a thank-you.") },
  { name: "ls", aliases: ["dir"], usage: "ls", blurb: "lists the windows", hidden: true, run: () => ok("profile  perks  stickers  achievements  collection  leaderboard") },
  { name: "cd", aliases: [], usage: "cd", blurb: "there is only home", hidden: true, run: () => ok("cd: you're already home.") },
  { name: "vim", aliases: ["vi", "emacs", "nano"], usage: "vim", blurb: "not an editor", hidden: true, run: (_args, _shell, invokedAs) => ok(`${invokedAs}: this is a hedgehog, not an editor. :q works in your head only.`) },
];

export const visibleCommands = commands.filter((c) => !c.hidden);
export const hiddenCommands = commands.filter((c) => c.hidden);

export const tokensOf = (line: string) => {
  const tokens = line.trim().replace(/^\$\s*/, "").split(/\s+/).filter(Boolean);
  return tokens[0]?.toLowerCase() === "hedgehug" ? tokens.slice(1) : tokens;
};

const find = (name: string) => commands.find((c) => c.name === name || c.aliases.includes(name));

export function parse(line: string, shell: Shell): Output | undefined {
  const [name, ...args] = tokensOf(line);
  if (!name) return undefined;
  const command = find(name.toLowerCase());
  if (!command) return error(`hedgehug: command not found: ${name}. try \`help\`.`);
  return command.run(args, shell, name.toLowerCase());
}

export function suggest(line: string): Command[] {
  const [first = ""] = tokensOf(line);
  const prefix = first.toLowerCase();
  if (!prefix) return visibleCommands;
  return visibleCommands.filter((c) => c.name.startsWith(prefix) || c.aliases.some((a) => a.startsWith(prefix)));
}
