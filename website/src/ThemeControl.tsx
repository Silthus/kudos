import type { ComponentType } from "react";
import { IconCheck, IconDay, IconLaptop, IconNight } from "@posthog/icons";
import { useTheme, type ThemeChoice } from "./theme";

const options: { choice: ThemeChoice; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { choice: "system", label: "Use system setting", Icon: IconLaptop },
  { choice: "light", label: "Light", Icon: IconDay },
  { choice: "dark", label: "Dark", Icon: IconNight },
];

export function ThemeControl() {
  const { choice, choose } = useTheme();
  return (
    <div role="group" aria-label="Theme" className="flex items-center gap-0.5 rounded-full border bg-card p-0.5">
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

function SelectedMark() {
  return (
    <span data-selected-mark aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <IconCheck className="size-2.5" />
    </span>
  );
}
