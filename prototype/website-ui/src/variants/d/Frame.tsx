// PROTOTYPE frame for the D variant: a terminal window with a tmux status line, a live prompt, --help and a skippable boot.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, Kbd } from "@posthog/quill";
import { HedgehogCodeBubble } from "@posthog/brand/hoggies";
import { IconMoon, IconSun } from "../../icons";
import type { LayoutProps } from "../../Layout";
import { me } from "../../data/mock";
import { useNav, type ScreenId } from "../../nav";
import { screens } from "../../screens";
import { hiddenCommands, parse, redesigned, screenCommand, suggest, tokensOf, visibleCommands, windows, type Command, type Output } from "./commands";
import { Comment, Cursor, Echo, Hoggie, LinkText, PROMPT, useTerminal } from "./term";

const nav = screens.filter((s) => s.inNav);

type LastRun = Output & { line: string };

export function TerminalFrame({ current, dark, toggle, children }: LayoutProps) {
  useTerminal();
  const { go, setSignedIn } = useNav();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [motdFor, setMotdFor] = useState<ScreenId | null>(current);
  const inputRef = useRef<HTMLInputElement>(null);
  const { typed, booted } = useBoot(screenCommand(current));

  const focusPrompt = () => {
    inputRef.current?.focus();
    setOpen(true);
  };

  const shell = { go, dark, toggleTheme: toggle, openHelp: () => setHelpOpen(true), clear: () => setMotdFor(null), signOut: () => setSignedIn(false) };

  const run = (line: string) => {
    setInput("");
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.blur();
    const output = parse(line, shell);
    setLastRun(output ? { ...output, line } : null);
  };

  useEffect(() => setLastRun(null), [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusPrompt();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as Element | null)?.closest?.("input, textarea, [contenteditable], [role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        focusPrompt();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= nav.length) go(nav[n - 1].id);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go]);

  const suggestions = suggest(input);

  const complete = (command: Command) => {
    const [, ...rest] = tokensOf(input);
    setInput([command.name, ...rest].join(" ") + (rest.length === 0 ? " " : ""));
    setHighlight(-1);
  };

  const onPromptKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Tab" && open && suggestions.length > 0) {
      e.preventDefault();
      complete(suggestions[Math.max(0, highlight)]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      inputRef.current?.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = highlight >= 0 ? suggestions[highlight] : undefined;
      const [, ...rest] = tokensOf(input);
      run(picked ? [picked.name, ...rest].join(" ") : input);
    }
  };

  const showMotd = motdFor === current;
  const ownScreen = redesigned.includes(current);

  return (
    <div className="hh-term flex min-h-screen flex-col font-mono text-[13px] leading-6 sm:text-sm">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="flex h-8 items-center gap-3 border-b px-3 text-xs text-muted-foreground">
          <span aria-hidden className="flex gap-1.5">
            <i className="size-2.5 rounded-full bg-destructive-foreground/70" />
            <i className="size-2.5 rounded-full bg-warning-foreground/70" />
            <i className="size-2.5 rounded-full bg-success-foreground/70" />
          </span>
          <span className="min-w-0 flex-1 truncate text-center">
            {me.name.toLowerCase().replace(" ", ".")}@hedgehug: ~/{windows[current]} — 80×24
          </span>
          <button type="button" onClick={shell.signOut} className="hover:text-foreground">
            exit
          </button>
          <Button variant="outline" size="icon-xs" onClick={toggle} aria-label={dark ? "Switch to light mode (paper)" : "Switch to dark mode (the void)"}>
            {dark ? <IconSun /> : <IconMoon />}
          </Button>
        </div>
        <nav aria-label="Windows" className="flex items-stretch overflow-x-auto bg-muted text-xs leading-6">
          <a href="#/profile" className="flex shrink-0 items-baseline gap-1.5 bg-primary px-2.5 font-semibold text-primary-foreground">
            HedgeHug
            <span className="hidden font-normal opacity-80 sm:inline">Thanks a Hog</span>
          </a>
          {nav.map((s, i) => (
            <a
              key={s.id}
              href={`#/${s.id}`}
              aria-current={s.id === current ? "page" : undefined}
              className={`flex shrink-0 items-baseline px-2.5 ${s.id === current ? "bg-foreground text-background" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
            >
              {i + 1}:{windows[s.id]}
              {s.id === current && "*"}
              {s.id === "skills" && me.skillPointsUnspent > 0 && <span className={`ml-1 font-semibold ${s.id === current ? "text-background/80" : "text-primary"}`}>+{me.skillPointsUnspent}</span>}
            </a>
          ))}
          <span className="ml-auto hidden shrink-0 items-baseline px-2.5 text-muted-foreground md:flex">
            {me.name} · lvl {me.level} · {me.kudosLeftToday}/{me.dailyAllowance} kudos today
          </span>
        </nav>
        <div className="relative">
          <label className="flex items-center gap-2 px-3 py-2">
            <span className="shrink-0 font-semibold text-primary">{PROMPT}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setOpen(true);
                setHighlight(-1);
              }}
              onKeyDown={onPromptKey}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              spellCheck={false}
              autoComplete="off"
              aria-label="Command prompt"
              aria-expanded={open}
              aria-controls="hh-suggestions"
              placeholder="type a command: help, perks --tree, leaderboard --month, theme"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
          </label>
          {open && <Suggestions commands={suggestions} highlight={highlight} onPick={(c) => run(c.name)} />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 sm:px-6">
        {lastRun && <LastOutput run={lastRun} onDismiss={() => setLastRun(null)} />}
        {showMotd && <Motd onClear={shell.clear} onHelp={shell.openHelp} />}
        {!booted ? (
          <div aria-live="polite" className="flex items-baseline gap-2">
            <span className="shrink-0 font-semibold text-primary">{PROMPT}</span>
            <span className="font-semibold">{typed}</span>
            <Cursor />
          </div>
        ) : ownScreen ? (
          children
        ) : (
          <>
            <Echo command={screenCommand(current)}>round-2 output, rendered in the shell</Echo>
            <div className="hh-in mt-4">{children}</div>
          </>
        )}
      </main>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} onRun={run} />
    </div>
  );
}

function useBoot(initialCommand: string) {
  const [target] = useState(initialCommand);
  const [typed, setTyped] = useState(() => (matchMedia("(prefers-reduced-motion: reduce)").matches ? target : ""));
  const booted = typed.length >= target.length;
  useEffect(() => {
    if (booted) return;
    const skip = () => setTyped(target);
    const timer = setInterval(() => setTyped((t) => target.slice(0, t.length + 1)), 42);
    addEventListener("keydown", skip);
    addEventListener("pointerdown", skip);
    return () => {
      clearInterval(timer);
      removeEventListener("keydown", skip);
      removeEventListener("pointerdown", skip);
    };
  }, [booted, target]);
  return { typed, booted };
}

function Suggestions({ commands, highlight, onPick }: { commands: Command[]; highlight: number; onPick: (c: Command) => void }) {
  return (
    <div className="absolute inset-x-0 top-full z-30 border-b bg-background shadow-md">
      <ul id="hh-suggestions" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
        {commands.length === 0 && <li className="px-3 py-1 text-xs text-muted-foreground">no such command. try `help`.</li>}
        {commands.map((c, i) => (
          <li key={c.name} role="option" aria-selected={i === highlight}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(c)}
              className={`flex w-full flex-wrap items-baseline gap-x-3 px-3 py-0.5 text-left ${i === highlight ? "bg-fill-selected" : "hover:bg-fill-hover"}`}
            >
              <span className="font-semibold">{c.usage}</span>
              <span className="text-xs text-muted-foreground">{c.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-3 border-t px-3 py-1 text-[11px] text-muted-foreground">
        <span>↑↓ pick</span>
        <span>tab complete</span>
        <span>enter run</span>
        <span>esc close</span>
      </div>
    </div>
  );
}

function LastOutput({ run, onDismiss }: { run: LastRun; onDismiss: () => void }) {
  return (
    <div className="hh-in mb-5" role="status">
      <Echo command={run.line.trim()} />
      <div className={`flex items-baseline gap-3 ${run.tone === "error" ? "text-destructive-foreground" : ""}`}>
        <span className="min-w-0">{run.text}</span>
        <button type="button" onClick={onDismiss} className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground">
          [dismiss]
        </button>
      </div>
    </div>
  );
}

function Motd({ onClear, onHelp }: { onClear: () => void; onHelp: () => void }) {
  const running = me.boosters.filter((b) => b.state === "running");
  return (
    <section aria-label="Message of the day" className="hh-in mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
      <Hoggie Hog={HedgehogCodeBubble} size={96} ascii />
      <div className="min-w-0 flex-1">
        <div>
          <span className="font-semibold">HedgeHug</span> 0.3.0 <span className="text-muted-foreground">(thanks-a-hog) · last login: today, from Slack</span>
        </div>
        <ul className="mt-2">
          <li>
            <span className="text-primary">*</span> {me.kudosLeftToday} of {me.dailyAllowance} kudos left today <Comment>they refill at your midnight</Comment>
          </li>
          {me.skillPointsUnspent > 0 && (
            <li>
              <span className="text-primary">*</span> {me.skillPointsUnspent} skill points unspent <Comment>spend them: <LinkText href="#/skills">perks --tree</LinkText></Comment>
            </li>
          )}
          {running.map((b) => (
            <li key={b.name}>
              <span className="text-primary">*</span> {b.name} running, {b.endsIn} left
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          type <LinkText onClick={onHelp}>help</LinkText> or press <Kbd>⌘K</Kbd>. keys 1–6 switch windows. <LinkText onClick={onClear}>clear</LinkText> hides this.
        </p>
      </div>
    </section>
  );
}

function HelpDialog({ open, onOpenChange, onRun }: { open: boolean; onOpenChange: (open: boolean) => void; onRun: (line: string) => void }) {
  const pick = (name: string) => {
    onOpenChange(false);
    onRun(name);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hh-mono font-mono text-[13px] leading-6" size="wide">
        <DialogHeader>
          <DialogTitle className="font-mono">
            <span className="text-primary">{PROMPT}</span> hedgehug --help
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p>
            <span className="font-semibold">hedgehug</span> — thank a hog, level up a human.
          </p>
          <p className="text-muted-foreground">usage: hedgehug &lt;command&gt; [flags]</p>
          <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,22rem)_1fr]">
            {visibleCommands.map((c) => (
              <div key={c.name} className="contents">
                <dt>
                  <LinkText onClick={() => pick(c.name)} className="text-left font-semibold">
                    {c.usage}
                  </LinkText>
                  {c.aliases.length > 0 && <span className="ml-2 text-xs text-muted-foreground">({c.aliases.join(", ")})</span>}
                </dt>
                <dd className="mb-2 text-muted-foreground sm:mb-0">{c.blurb}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-muted-foreground">not commands, but people keep trying:</p>
          <dl className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,22rem)_1fr]">
            {hiddenCommands.map((c) => (
              <div key={c.name} className="contents">
                <dt>
                  <LinkText onClick={() => pick(c.name)} className="text-left">
                    {c.usage}
                  </LinkText>
                </dt>
                <dd className="mb-2 text-muted-foreground sm:mb-0">{c.blurb}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">
            keys: <Kbd>⌘K</Kbd> or <Kbd>/</Kbd> focus the prompt · <Kbd>1</Kbd>–<Kbd>6</Kbd> switch windows · every output is clickable too, we're not monsters.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
