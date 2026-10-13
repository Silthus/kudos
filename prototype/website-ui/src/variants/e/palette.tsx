// Variant E command palette: a Cmd/Ctrl-K overlay in E's HUD look that navigates, answers D's trap commands, shows locked screens with their unlock level and opens ready crates.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { IconChevronRight, IconLock, IconSparkles, IconWarning } from "@posthog/icons";
import { Kbd } from "@posthog/quill";
import { HedgehogCodeBubble } from "@posthog/brand/hoggies";
import { hiddenCommands, run, stateOf, suggest, tokensOf, visibleCommands, type Command, type Output, type Shell } from "./palette-commands";
import { CrateGlyph } from "./unlock-crate";
import { unlockOf, usePreviewLevel, type FeatureState } from "./unlocks";

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const paletteKey = () => (isMac() ? "⌘K" : "Ctrl K");

export function usePaletteHotkey(onToggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onToggle();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onToggle]);
}

type View = "suggest" | "help";

export function CommandPalette({ open, onClose, shell }: { open: boolean; onClose: () => void; shell: Omit<Shell, "openHelp" | "level"> }) {
  if (!open) return null;
  return <PaletteOverlay onClose={onClose} shell={shell} />;
}

function PaletteOverlay({ onClose, shell }: { onClose: () => void; shell: Omit<Shell, "openHelp" | "level"> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const level = usePreviewLevel();
  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const [output, setOutput] = useState<(Output & { line: string }) | null>(null);
  const [view, setView] = useState<View>("suggest");
  const suggestions = view === "help" ? [...visibleCommands, ...hiddenCommands] : suggest(input);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const execute = (line: string) => {
    const outcome = run(line, { ...shell, level, openHelp: () => setView("help") });
    setInput("");
    setHighlight(-1);
    if (outcome.kind === "close") return onClose();
    setOutput(outcome.output ? { ...outcome.output, line: line.trim() } : null);
    inputRef.current?.focus();
  };

  const complete = (command: Command) => {
    const [, ...rest] = tokensOf(input);
    setInput([command.name, ...rest].join(" ") + (rest.length === 0 ? " " : ""));
    setHighlight(-1);
    setView("suggest");
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      complete(suggestions[Math.max(0, highlight)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (view === "help") setView("suggest");
      else onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = highlight >= 0 ? suggestions[highlight] : undefined;
      const [, ...rest] = tokensOf(input);
      execute(picked ? [picked.name, ...rest].join(" ") : input);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center px-3 pt-[12vh] sm:pt-[16vh]" role="presentation">
      <button type="button" aria-label="Close the command palette" tabIndex={-1} onClick={onClose} className="hud-fade absolute inset-0 cursor-default bg-neutral-950/30 backdrop-blur-[3px] dark:bg-neutral-950/60" />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="hud-panel hud-rise relative w-full max-w-xl overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl ring-1 ring-primary/15">
        <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <label className="relative flex items-center gap-3 border-b px-4 py-3">
          <span className="hud-display shrink-0 text-lg font-bold text-primary" aria-hidden>
            &gt;
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHighlight(-1);
              setView("suggest");
            }}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="hud-palette-list"
            aria-activedescendant={highlight >= 0 ? `hud-cmd-${suggestions[highlight]?.name}` : undefined}
            aria-label="Command"
            placeholder="Try skills, lb --month, theme or help"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground caret-primary outline-none placeholder:text-muted-foreground"
          />
          <Kbd>esc</Kbd>
        </label>

        {output && <OutputLine output={output} />}

        <div className="relative max-h-[min(24rem,55vh)] overflow-y-auto p-1.5">
          {view === "help" ? (
            <HelpList highlight={highlight} level={level} onPick={(c) => execute(c.name)} />
          ) : suggestions.length === 0 ? (
            <Empty input={input} />
          ) : (
            <ul id="hud-palette-list" role="listbox" aria-label="Commands">
              {suggestions.map((c, i) => (
                <CommandRow key={c.name} command={c} state={stateOf(c, level)} active={i === highlight} onPick={() => execute(c.name)} onHover={() => setHighlight(i)} />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> pick
          </span>
          <span className="flex items-center gap-1">
            <Kbd>tab</Kbd> complete
          </span>
          <span className="flex items-center gap-1">
            <Kbd>enter</Kbd> run
          </span>
          {view === "suggest" && (
            <button type="button" onClick={() => setView("help")} className="ml-auto hover:text-foreground">
              Show everything
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const stateBlurb = (command: Command, state: FeatureState) =>
  state === "locked" ? `Locked · unlocks at level ${unlockOf(command.feature!).level}` : state === "ready" ? "Ready · run it to open its crate" : command.blurb;

function CommandRow({ command, state, active, onPick, onHover }: { command: Command; state: FeatureState; active: boolean; onPick: () => void; onHover: () => void }) {
  const locked = state !== "unlocked";
  const Icon = state === "ready" ? CrateGlyph : locked ? IconLock : command.Icon;
  const blurb = stateBlurb(command, state);
  return (
    <li id={`hud-cmd-${command.name}`} role="option" aria-selected={active}>
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onMouseMove={onHover}
        onClick={onPick}
        className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${active ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/40" : "hover:bg-fill-hover"}`}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${active && !locked ? "bg-primary text-primary-foreground ring-primary" : "bg-muted text-muted-foreground ring-border"}`}>
          {Icon ? <Icon className="size-4" /> : <IconSparkles className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-mono text-[13px] font-semibold ${locked ? "text-muted-foreground" : ""}`}>{command.usage}</span>
          <span className="block truncate text-xs text-muted-foreground">{blurb}</span>
        </span>
        {!locked && command.aliases.length > 0 && <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">{command.aliases.slice(0, 2).join(" · ")}</span>}
        <IconChevronRight className={`size-4 shrink-0 ${active ? "text-primary" : "text-transparent"}`} />
      </button>
    </li>
  );
}

function HelpList({ highlight, level, onPick }: { highlight: number; level: number; onPick: (c: Command) => void }) {
  return (
    <div id="hud-palette-list" role="listbox" aria-label="Every command">
      <div className="hud-label px-2.5 pb-1 pt-1.5">Commands</div>
      <ul>
        {visibleCommands.map((c, i) => (
          <CommandRow key={c.name} command={c} state={stateOf(c, level)} active={i === highlight} onPick={() => onPick(c)} onHover={() => {}} />
        ))}
      </ul>
      <div className="hud-label px-2.5 pb-1 pt-3">Not commands, but people keep trying</div>
      <ul className="flex flex-wrap gap-1.5 px-2.5 pb-2">
        {hiddenCommands.map((c, i) => (
          <li key={c.name} id={`hud-cmd-${c.name}`} role="option" aria-selected={visibleCommands.length + i === highlight}>
            <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(c)} title={c.blurb} className={`rounded-md border px-2 py-1 font-mono text-xs hover:border-primary hover:text-foreground ${visibleCommands.length + i === highlight ? "border-primary text-foreground" : "text-muted-foreground"}`}>
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutputLine({ output }: { output: Output & { line: string } }) {
  const failed = output.tone === "error";
  return (
    <div role="status" className="hud-rise relative flex items-start gap-3 border-b px-4 py-3 text-sm">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${failed ? "bg-warning text-warning-foreground" : "bg-primary/15 text-primary"}`}>
        {failed ? <IconWarning className="size-3.5" /> : <IconSparkles className="size-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xs text-muted-foreground">&gt; {output.line}</span>
        <span className="block">{output.text}</span>
      </span>
    </div>
  );
}

function Empty({ input }: { input: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-4 text-sm text-muted-foreground">
      <HedgehogCodeBubble size={44} title="" />
      <span>
        Nothing starts with <span className="font-mono text-foreground">{tokensOf(input)[0]}</span>. Press enter anyway, or try help.
      </span>
    </div>
  );
}
