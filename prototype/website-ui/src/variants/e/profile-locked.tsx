// Variant E locked home card: a calm placeholder for a feature not yet opened, showing its level, or the crate waiting to be opened.
import { IconLock } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { levelsToGoText, featureLook } from "./unlock-features";
import { showCrate, unlockOf, useFeatureState, usePreviewLevel, type Feature } from "./unlocks";
import { Panel } from "./hud";

export function LockedCard({ feature }: { feature: Feature }) {
  const state = useFeatureState(feature);
  const level = usePreviewLevel();
  const unlock = unlockOf(feature);
  const { Hog } = featureLook[feature];
  const ready = state === "ready";
  return (
    <Panel label={unlock.name}>
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <Hog size={48} className={ready ? "" : "opacity-40 grayscale"} title="" />
          {!ready && (
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
              <IconLock className="size-3" />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{ready ? "Ready to open" : `Unlocks at level ${unlock.level}`}</span>
          <span className="text-xs text-muted-foreground">{unlock.teaser}</span>
          {!ready && <span className="text-xs text-muted-foreground">{levelsToGoText(feature, level)}</span>}
        </div>
        {ready && (
          <Button variant="primary" size="sm" onClick={() => showCrate(feature)}>
            Open
          </Button>
        )}
      </div>
    </Panel>
  );
}
