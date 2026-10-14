import { Button } from "@posthog/quill";
import { readyFeaturesOf } from "../features";
import type { MemberProfile } from "../shell";
import { CrateGlyph } from "./CrateArt";
import { attemptMessages, useMoments } from "./moments";

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
      {opening ? "Opening…" : <ReadyCount count={ready.length} />}
    </Button>
  );
}

export function ReadyPillFailure({ member }: { member: MemberProfile }) {
  const moments = useMoments();
  const first = readyFeaturesOf(member)[0];
  const attempt = first && moments?.attemptOf(first.feature);
  if (attempt === undefined || attempt === "opening") return null;
  return <p className="order-last w-full pb-2 text-right text-xs font-medium max-sm:text-left">{attemptMessages[attempt]}</p>;
}

function ReadyCount({ count }: { count: number }) {
  return (
    <>
      {count} <span className="max-sm:sr-only">ready</span>
    </>
  );
}
