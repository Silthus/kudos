import type { ComponentType } from "react";
import { IconCheck, IconDay, IconLaptop, IconNight } from "@posthog/icons";
import { useTheme, type ThemeChoice } from "./theme";

type Option = { choice: ThemeChoice; label: string; short: string; Icon: ComponentType<{ className?: string }> };

const optionOf: Record<ThemeChoice, Option> = {
  system: { choice: "system", label: "Use system setting", short: "System", Icon: IconLaptop },
  light: { choice: "light", label: "Light", short: "Light", Icon: IconDay },
  dark: { choice: "dark", label: "Dark", short: "Dark", Icon: IconNight },
};

const options = [optionOf.system, optionOf.light, optionOf.dark];

const choiceAfter: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" };

export function ThemeControl() {
  const { choice, choose } = useTheme();
  return (
    <>
      <ThemeGroup choice={choice} choose={choose} />
      <ThemeCycleButton choice={choice} choose={choose} />
    </>
  );
}

type ThemeProps = { choice: ThemeChoice; choose: (choice: ThemeChoice) => void };

function ThemeGroup({ choice, choose }: ThemeProps) {
  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-0.5 rounded-full border bg-card p-0.5 max-sm:hidden">
      {options.map((option) => {
        const selected = option.choice === choice;
        return (
          <button
            key={option.choice}
            type="button"
            aria-pressed={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => choose(option.choice)}
            className={`relative flex size-7 items-center justify-center rounded-full border transition-colors ${selected ? "border-primary bg-fill-selected text-foreground" : "border-transparent text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
          >
            <option.Icon className="size-4" />
            {selected && <SelectedMark />}
          </button>
        );
      })}
    </div>
  );
}

function ThemeCycleButton({ choice, choose }: ThemeProps) {
  const current = optionOf[choice];
  const next = optionOf[choiceAfter[choice]];
  const name = `Theme: ${current.short}. Switch to ${next.short}`;
  return (
    <button
      type="button"
      aria-label={name}
      title={name}
      onClick={() => choose(next.choice)}
      className="flex size-8 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:bg-fill-hover sm:hidden"
    >
      <current.Icon className="size-4" />
    </button>
  );
}

function SelectedMark() {
  return (
    <span data-selected-mark aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <IconCheck className="size-2.5" />
    </span>
  );
}
