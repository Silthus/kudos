// Variant E leaderboard faces: members show their Slack picture, the viewer shows their equipped hedgehog, and groups carry a hedgehog crest.
import type { ComponentType } from "react";
import { HedgehogCampfireCowboy, HedgehogClimber, HedgehogConstruction, HedgehogNamaste, HedgehogSafari, HedgehogSitting } from "@posthog/brand/hoggies";
import { IconLock } from "@posthog/icons";
import { Avatar } from "./avatars";
import { useHogs } from "./hedgehogs";

type Art = ComponentType<{ size?: number; className?: string; title?: string }>;

const crests: Record<string, Art> = {
  "Team Acorn": HedgehogCampfireCowboy,
  "Team Bramble": HedgehogClimber,
  "Team Burrow": HedgehogConstruction,
  "Team Moss": HedgehogNamaste,
  "Team Thistle": HedgehogSafari,
};

const ring = (mine?: boolean) => (mine ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border");

export function MemberFace({ name, me, size }: { name: string; me?: boolean; size: number }) {
  return me ? <MyHog size={size} /> : <Avatar name={name} size={size} className={ring(false)} />;
}

function MyHog({ size }: { size: number }) {
  const { equipped } = useHogs();
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-muted ${ring(true)}`} style={{ width: size, height: size }}>
      <equipped.Art size={Math.round(size * 0.92)} title={`You, as ${equipped.name}`} />
    </span>
  );
}

export function HiddenFace({ size }: { size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-muted text-muted-foreground" style={{ width: size, height: size }} aria-label="You, off the board">
      <IconLock className="size-1/3" />
    </span>
  );
}

export function GroupCrest({ group, mine, size }: { group: string; mine?: boolean; size: number }) {
  const Art = crests[group] ?? HedgehogSitting;
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-b-[50%] rounded-t-[28%] bg-muted ${ring(mine)}`} style={{ width: size, height: Math.round(size * 1.12) }}>
      <Art size={Math.round(size * 0.98)} title={`${group} crest`} />
    </span>
  );
}
