import { useState } from "react";
import { Button } from "@posthog/quill";
import { hogOf } from "../features";
import type { FeatureCard } from "../shell";
import { CrateArt } from "./CrateArt";
import { attemptMessages, useMoments } from "./moments";
import { featureCrateOf } from "./readyCrates";

type CrateProps = { card: FeatureCard; heading: "h2" | "h3"; open: "primary" | "outline"; artWidth: number; framed?: boolean };

const frame = "hud-panel relative h-full rounded-lg border bg-card p-4";

export function Crate({ card, heading: Heading, open, artWidth, framed = true }: CrateProps) {
  const crate = useFeatureCrate(card);
  return (
    <article className={`flex items-center gap-4 ${framed ? frame : ""}`}>
      <CrateArt phase="closed" width={artWidth} Hog={hogOf(card.feature)} nudge={crate.nudge} seen={card.seen} />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Heading className="text-sm font-medium">{`Unlocks: ${card.name}`}</Heading>
        <p className="text-xs text-muted-foreground">{`It opens ${card.opens}.`}</p>
        {crate.failure !== undefined && <p className="text-xs font-medium">{crate.failure}</p>}
        <OpenButton crate={crate} variant={open} size="sm" className="mt-1" />
      </div>
    </article>
  );
}

export type FeatureCrateAttempt = { opening: boolean; failure: string | undefined; nudge: boolean; open: () => void };

export function useFeatureCrate(card: FeatureCard): FeatureCrateAttempt {
  const moments = useMoments();
  const crate = featureCrateOf(card);
  const attempt = moments?.attemptOf(crate);
  const opening = attempt === "opening";
  const [stillSinceOpen, keepStill] = useState(false);
  if (attempt !== undefined && !stillSinceOpen) keepStill(true);
  return {
    opening,
    failure: attempt === undefined || opening ? undefined : attemptMessages[attempt],
    nudge: !stillSinceOpen,
    open: () => {
      if (!opening) moments?.claim(crate);
    },
  };
}

type OpenButtonProps = { crate: FeatureCrateAttempt; variant: "primary" | "outline"; size: "sm" | "lg"; className?: string };

export function OpenButton({ crate, variant, size, className }: OpenButtonProps) {
  return (
    <Button variant={variant} size={size} className={className} aria-disabled={crate.opening || undefined} onClick={crate.open}>
      {crate.opening ? "Opening…" : "Open"}
    </Button>
  );
}
