import { useState } from "react";
import { Button } from "@posthog/quill";
import { aboutOf } from "../features";
import { CrateArt } from "./CrateArt";
import { attemptMessages, useMoments } from "./moments";
import { rewardLabelOf, type QuestCrate } from "./readyCrates";
import { rewardChipAttributes } from "./RewardFlight";

type RewardCrateProps = { crate: QuestCrate; open: "primary" | "outline" };

export function RewardCrate({ crate, open }: RewardCrateProps) {
  const moments = useMoments();
  const attempt = moments?.attemptOf(crate);
  const opening = attempt === "opening";
  const [stillSinceOpen, keepStill] = useState(false);
  if (attempt !== undefined && !stillSinceOpen) keepStill(true);
  return (
    <div className="flex items-center gap-3">
      <CrateArt phase="closed" width={56} Hog={aboutOf("quests").Hog} nudge={!stillSinceOpen} />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="text-sm font-medium" {...rewardChipAttributes(crate.seen)}>{`${rewardLabelOf(crate)} · ${crate.xp} XP`}</p>
        {attempt !== undefined && !opening && <p className="text-xs font-medium">{attemptMessages[attempt]}</p>}
        <Button
          variant={open}
          size="sm"
          className="mt-1"
          aria-disabled={opening || undefined}
          onClick={() => {
            if (!opening) moments?.claim(crate);
          }}
        >
          {opening ? "Opening…" : "Open"}
        </Button>
      </div>
    </div>
  );
}

export function Done({ children }: { children?: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">
      <span aria-hidden="true">✓</span> Done{children !== undefined && ` · ${children}`}
    </p>
  );
}
