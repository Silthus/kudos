import { useState } from "react";
import { Button } from "@posthog/quill";
import { aboutOf } from "../features";
import type { FeatureCard } from "../shell";
import { CrateArt } from "./CrateArt";
import { attemptMessages, useMoments } from "./moments";
import { featureCrateOf } from "./readyCrates";

type CrateProps = { card: FeatureCard; heading: "h2" | "h3"; open: "primary" | "outline"; artWidth: number; framed?: boolean };

const frame = "hud-panel relative h-full rounded-xl border bg-card p-4";

export function Crate({ card, heading: Heading, open, artWidth, framed = true }: CrateProps) {
  const moments = useMoments();
  const crate = featureCrateOf(card);
  const attempt = moments?.attemptOf(crate);
  const opening = attempt === "opening";
  const [stillSinceOpen, keepStill] = useState(false);
  if (attempt !== undefined && !stillSinceOpen) keepStill(true);
  return (
    <article className={`flex items-center gap-4 ${framed ? frame : ""}`}>
      <CrateArt phase="closed" width={artWidth} Hog={aboutOf(card.feature).Hog} nudge={!stillSinceOpen} />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Heading className="text-sm font-medium">{`Unlocks: ${card.name}`}</Heading>
        <p className="text-xs text-muted-foreground">{`It opens ${card.opens}.`}</p>
        {attempt !== undefined && attempt !== "opening" && <p className="text-xs font-medium">{attemptMessages[attempt]}</p>}
        <Button
          variant={open}
          size="sm"
          className="mt-1"
          aria-disabled={opening || undefined}
          onClick={() => {
            if (!opening) moments?.open(crate);
          }}
        >
          {opening ? "Opening…" : "Open"}
        </Button>
      </div>
    </article>
  );
}
