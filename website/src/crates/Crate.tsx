import { Button } from "@posthog/quill";
import { aboutOf } from "../features";
import type { FeatureCard } from "../shell";
import { CrateArt } from "./CrateArt";
import { attemptMessages, useMoments } from "./moments";

type CrateProps = { card: FeatureCard; heading: "h2" | "h3"; open: "primary" | "outline"; artWidth: number };

export function Crate({ card, heading: Heading, open, artWidth }: CrateProps) {
  const moments = useMoments();
  const attempt = moments?.attemptOf(card.feature);
  const opening = attempt === "opening";
  return (
    <article className="hud-panel relative flex h-full items-center gap-4 rounded-xl border bg-card p-4">
      <CrateArt phase="closed" width={artWidth} Hog={aboutOf(card.feature).Hog} nudge />
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
            if (!opening) moments?.open(card);
          }}
        >
          {opening ? "Opening…" : "Open"}
        </Button>
      </div>
    </article>
  );
}
