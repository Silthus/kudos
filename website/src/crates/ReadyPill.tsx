import { Button } from "@posthog/quill";
import { readyFeaturesOf } from "../features";
import type { MemberProfile } from "../shell";
import { CrateGlyph } from "./CrateArt";
import { useMoments } from "./moments";

export function ReadyPill({ member }: { member: MemberProfile }) {
  const moments = useMoments();
  const ready = readyFeaturesOf(member);
  const first = ready[0];
  if (moments === undefined || first === undefined) return null;
  const opening = moments.attemptOf(first.feature) === "opening";
  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={opening || undefined}
      onClick={() => {
        if (!opening) moments.open(first);
      }}
    >
      <CrateGlyph className="size-4" />
      {opening ? "Opening…" : `${ready.length} ready`}
    </Button>
  );
}
