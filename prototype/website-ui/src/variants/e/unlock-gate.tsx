// Variant E unlock gate: a locked screen opened by URL shows a blurred ghost of what waits, its hedgehog, the unlock level and the climb toward it.
import type { ComponentType } from "react";
import { IconLock } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { useNav } from "../../nav";
import type { ScreenComponent } from "../types";
import { hedgehogs } from "./hedgehogs";
import { Panel, useHud } from "./hud";
import { featureLook, levelsToGoText } from "./unlock-features";
import { unlockOf, usePreviewLevel, useUnlocked, type Feature } from "./unlocks";

export function gated(feature: Feature, Screen: ScreenComponent): ScreenComponent {
  return function GatedScreen(props) {
    const open = useUnlocked(feature);
    return open ? <Screen {...props} /> : <LockedScreen feature={feature} />;
  };
}

export function LockedScreen({ feature }: { feature: Feature }) {
  useHud();
  const { go } = useNav();
  const level = usePreviewLevel();
  const unlock = unlockOf(feature);
  const { Hog } = featureLook[feature];
  const Ghost = ghosts[feature];
  return (
    <div className="hud-rise mx-auto flex w-full max-w-3xl flex-col">
      <Panel className="overflow-hidden" bodyClassName="relative">
        <div className="pointer-events-none absolute inset-0 select-none [mask-image:radial-gradient(75%_70%_at_50%_45%,transparent_30%,#000_85%)]" aria-hidden>
          <Ghost />
        </div>
        <div className="relative flex flex-col items-center gap-4 px-2 py-10 text-center md:py-14">
          <span className="relative inline-flex">
            <Hog size={128} className="h-auto w-28 md:w-32" title="" />
            <span className="absolute -bottom-1 -right-2 flex size-9 items-center justify-center rounded-full bg-foreground text-background ring-4 ring-card">
              <IconLock className="size-4" />
            </span>
          </span>
          <span className="hud-label">Locked · {unlock.name}</span>
          <h1 className="hud-display text-4xl font-bold leading-none md:text-5xl">Unlocks at level {unlock.level}</h1>
          <p className="max-w-md text-balance text-base">{unlock.teaser}</p>
          <p className="max-w-md text-balance text-sm text-muted-foreground">{unlock.how}</p>
          <Climb level={level} goal={unlock.level} />
          <p className="text-sm">
            You're level <span className="font-semibold tabular-nums">{level}</span>
            <span className="text-muted-foreground">: {levelsToGoText(feature, level)}</span>
          </p>
          <Button variant="primary" className="mt-2" onClick={() => go("profile")}>
            Back to your profile
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Climb({ level, goal }: { level: number; goal: number }) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5" role="img" aria-label={`Level ${level} of ${goal}`}>
      <div className="flex gap-1">
        {Array.from({ length: goal }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < level ? "bg-foreground" : "bg-muted ring-1 ring-inset ring-border"}`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
        <span>Level 1</span>
        <span className="flex items-center gap-1">
          <IconLock className="size-2.5" />
          Level {goal}
        </span>
      </div>
    </div>
  );
}

const ghostFrame = "absolute inset-0 flex items-center justify-center p-6 opacity-60 blur-[5px] dark:opacity-45";

function TreeGhost() {
  return (
    <div className={ghostFrame}>
      <div className="grid w-full grid-cols-3 gap-8">
        {Array.from({ length: 3 }, (_, tree) => (
          <div key={tree} className="grid grid-cols-4 gap-x-3 gap-y-8">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={`aspect-square rounded-lg border-2 ${(i + tree) % 5 === 0 ? "border-foreground bg-foreground" : "border-muted-foreground/40 bg-muted"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookGhost() {
  return (
    <div className={ghostFrame}>
      <div className="grid w-full grid-cols-6 gap-4">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className={`aspect-square rounded-full border-4 border-card shadow ${i % 4 === 0 ? "bg-foreground/70" : "bg-muted-foreground/35"}`} />
        ))}
      </div>
    </div>
  );
}

function ShelfGhost() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 opacity-25 blur-[2px]">
      <div className="grid w-full grid-cols-3 place-items-center gap-6 sm:grid-cols-6">
        {hedgehogs.slice(0, 12).map((hog) => (
          <span key={hog.id} className="brightness-0 dark:invert">
            <hog.Art size={88} title="" />
          </span>
        ))}
      </div>
    </div>
  );
}

function SlotGhost() {
  return (
    <div className={ghostFrame}>
      <div className="grid w-full grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="h-20 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-muted" />
        ))}
      </div>
    </div>
  );
}

const ghosts: Record<Feature, ComponentType> = {
  book: BookGhost,
  gear: SlotGhost,
  skills: TreeGhost,
  coins: SlotGhost,
  collection: ShelfGhost,
};
