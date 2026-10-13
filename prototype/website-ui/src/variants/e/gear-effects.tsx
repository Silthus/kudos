// Variant E active effects at the top of the profile rail: boosters running or ready to switch on, and, once the skill tree opens, one line on the perks already working for you.
import { useState, type ComponentType } from "react";
import { IconArrowRight, IconBolt, IconLightBulb } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { me, perks } from "../../data/mock";
import { Panel, Tag } from "./hud";
import { useUnlocked } from "./unlocks";

const ownedPerks = perks.filter((p) => p.state.kind === "owned").map((p) => p.name);

const perkLine = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

const boosterIcon = (name: string): ComponentType<{ className?: string }> => (name === "Discovery Lantern" ? IconLightBulb : IconBolt);

export function ActiveEffects() {
  const [switchedOn, setSwitchedOn] = useState<string[]>([]);
  const skillsOpen = useUnlocked("skills");
  return (
    <Panel label="Active effects">
      <ul className="flex flex-col divide-y">
        {me.boosters.map((b) => {
          const Icon = boosterIcon(b.name);
          const running = b.state === "running" || switchedOn.includes(b.name);
          return (
            <li key={b.name} className="flex items-center gap-3 py-2.5 first:pt-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground ring-1 ring-inset ring-border" aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{b.name}</span>
                <span className="block text-xs text-muted-foreground">{b.state === "running" ? `${b.endsIn} left` : running ? "Just switched on" : "Ready when you are"}</span>
              </span>
              {running ? (
                <Tag variant="success">Running</Tag>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSwitchedOn((s) => [...s, b.name])}>
                  Switch on
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {skillsOpen && (
        <a href="#/skills" className="group mt-1 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground hover:text-foreground">
          <span>
            <span className="font-medium text-foreground">{ownedPerks.length} perks</span> always on: {perkLine(ownedPerks)}.
          </span>
          <IconArrowRight className="size-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </a>
      )}
    </Panel>
  );
}
