import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { HedgehogTownCrier } from "@posthog/brand/hoggies";
import { IconChevronRight, IconLock, IconSparkles, IconWarning } from "@posthog/icons";
import { run, suggestionsFor, traps, wordsOf, type Command, type Printed, type Shell } from "./commands";
import "./palette.css";

type View = "suggest" | "help";

const keyHints = [
  ["↑↓", "select"],
  ["Tab", "complete"],
  ["↵", "run"],
  ["Esc", "close"],
];

type Shown = Printed & { line: string; count: number };

export function CommandPalette({ commands, shell, onClose }: { commands: Command[]; shell: Shell; onClose: () => void }) {
  const ids = useId();
  const field = useRef<HTMLInputElement>(null);
  const [line, setLine] = useState("");
  const [view, setView] = useState<View>("suggest");
  const [selectedName, select] = useState<string>();
  const [shown, setShown] = useState<Shown>();
  const [opener] = useState(() => document.activeElement);
  const listed = view === "help" ? commands : suggestionsFor(line, commands);
  const optionId = (command: Command) => `${ids}-${command.name}`;
  const at = listed.findIndex(({ name }) => name === selectedName);
  const selection = listed[at];

  useEffect(() => {
    field.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [opener]);

  useEffect(() => {
    if (selectedName !== undefined) document.getElementById(`${ids}-${selectedName}`)?.scrollIntoView({ block: "nearest" });
  }, [ids, selectedName]);

  const type = (next: string) => {
    setLine(next);
    select(undefined);
    setView("suggest");
  };

  const selectAt = (next: number) => select(listed[next]?.name);

  const execute = (typed: string) => {
    const outcome = run(typed, commands, shell);
    if (outcome.kind === "close") return onClose();
    type("");
    if (outcome.kind === "help") setView("help");
    if (outcome.kind === "print") setShown((last) => ({ ...outcome.printed, line: typed.trim(), count: (last?.count ?? 0) + 1 }));
    field.current?.focus();
  };

  const withRestOfLine = (command: Command) => {
    const [typed = "", ...rest] = wordsOf(line);
    const invokedAs = command.aliases.includes(typed.toLowerCase()) ? typed.toLowerCase() : command.name;
    return [invokedAs, ...rest].join(" ");
  };

  const keyActions: Record<string, () => void> = {
    ArrowDown: () => selectAt(Math.min(listed.length - 1, at + 1)),
    ArrowUp: () => selectAt(at - 1),
    Tab: () => {
      const completed = selection ?? listed[0];
      if (completed !== undefined) type(`${withRestOfLine(completed)}${wordsOf(line).length > 1 ? "" : " "}`);
    },
    Enter: () => execute(selection ? withRestOfLine(selection) : line),
    Escape: onClose,
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const act = keyActions[event.key];
    if (act === undefined) return;
    event.preventDefault();
    act();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12dvh] sm:pt-[16dvh]">
      <div data-palette-backdrop aria-hidden="true" onClick={onClose} className="palette-fade absolute inset-0 bg-neutral-950/40 dark:bg-neutral-950/60" />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="hud-panel palette-rise relative flex max-h-[80dvh] w-full max-w-xl flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl">
        <label className="flex items-center gap-3 border-b px-4 py-3">
          <span aria-hidden="true" className="hud-display shrink-0 text-lg font-bold text-primary">
            &gt;
          </span>
          <input
            ref={field}
            value={line}
            onChange={(event) => type(event.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-label="Command"
            aria-expanded={listed.length > 0}
            aria-controls={`${ids}-list`}
            aria-autocomplete="list"
            aria-activedescendant={selection ? optionId(selection) : undefined}
            placeholder="Try quests, lb --month, theme dark or help"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground caret-primary outline-none placeholder:text-muted-foreground"
          />
          <Key>Esc</Key>
        </label>
        <div role="status">
          {shown && <PrintedLine key={shown.count} shown={shown} />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {view === "help" && <Heading>Commands</Heading>}
          <ul id={`${ids}-list`} role="listbox" aria-label={view === "help" ? "Every command" : "Commands"}>
            {listed.map((command) => (
              <CommandRow key={command.name} id={optionId(command)} command={command} selected={command === selection} onPick={() => execute(withRestOfLine(command))} onPoint={() => select(command.name)} />
            ))}
          </ul>
          {view === "suggest" && listed.length === 0 && <NothingMatches line={line} />}
          {view === "help" && <TrapList onPick={execute} />}
        </div>
        <footer className="border-t bg-fill-hover px-4 py-2 text-[11px] leading-5 text-muted-foreground">
          {keyHints.map(([key, does], at) => (
            <Fragment key={key}>
              {at > 0 && " · "}
              <Key>{key}</Key> {does}
            </Fragment>
          ))}
        </footer>
      </div>
    </div>
  );
}

function CommandRow({ id, command, selected, onPick, onPoint }: { id: string; command: Command; selected: boolean; onPick: () => void; onPoint: () => void }) {
  const waiting = command.state !== "open";
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={onPoint}
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 ${selected ? "bg-fill-selected ring-1 ring-inset ring-primary" : "hover:bg-fill-hover"}`}
    >
      <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-md ${selected && !waiting ? "bg-primary text-primary-foreground ring-1 ring-inset ring-primary" : "bg-fill-hover text-muted-foreground"}`}>
        <command.Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-mono text-[13px] font-semibold ${waiting ? "text-muted-foreground" : ""}`}>{command.usage}</span>
        <span className="block truncate text-xs text-muted-foreground">{command.blurb}</span>
        {command.aliases.length > 0 && <span className="block truncate font-mono text-[11px] text-muted-foreground">{command.aliases.join(" · ")}</span>}
      </span>
      <IconChevronRight aria-hidden="true" className={`size-4 shrink-0 ${selected ? "text-primary" : "invisible"}`} />
    </li>
  );
}

function TrapList({ onPick }: { onPick: (line: string) => void }) {
  return (
    <>
      <Heading>Not commands, but people keep trying</Heading>
      <ul aria-label="Not commands, but people keep trying" className="flex flex-wrap gap-1.5 px-2.5 pb-2">
        {traps.map(({ name }) => (
          <li key={name}>
            <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(name)} className="rounded-md border border-muted-foreground px-2 py-1 font-mono text-xs text-muted-foreground hover:border-foreground hover:text-foreground">
              {name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function PrintedLine({ shown }: { shown: Shown }) {
  return (
    <div className="palette-rise flex items-start gap-3 border-b px-4 py-3 text-sm">
      <ToneMark tone={shown.tone} />
      <span className="min-w-0">
        <span className="block font-mono text-xs text-muted-foreground">
          <span aria-hidden="true">&gt; </span>
          {shown.line}
        </span>
        <span className="block">{shown.text}</span>
      </span>
    </div>
  );
}

function ToneMark({ tone }: { tone: Printed["tone"] }) {
  if (tone === "unknown") return <HedgehogTownCrier data-tone={tone} size={40} title="" className="shrink-0" />;
  const { Icon, look } = toneMarks[tone];
  return (
    <span data-tone={tone} aria-hidden="true" className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${look}`}>
      <Icon className="size-3.5" />
    </span>
  );
}

const toneMarks = {
  said: { Icon: IconSparkles, look: "bg-fill-selected text-primary" },
  refused: { Icon: IconWarning, look: "bg-warning text-warning-foreground" },
  locked: { Icon: IconLock, look: "bg-fill-hover text-muted-foreground" },
};

function NothingMatches({ line }: { line: string }) {
  return (
    <p className="flex items-center gap-3 px-3 py-4 text-sm text-muted-foreground">
      <HedgehogTownCrier size={40} title="" className="shrink-0" />
      <span>
        Nothing starts with <span className="font-mono text-foreground">{wordsOf(line)[0]}</span>. Press Enter anyway, or try help.
      </span>
    </p>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="hud-label px-2.5 pb-1 pt-1.5">{children}</div>;
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-muted-foreground bg-card px-1.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}
