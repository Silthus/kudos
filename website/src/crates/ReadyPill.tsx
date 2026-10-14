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
  const attempt = moments.attemptOf(first.feature);
  const opening = attempt === "opening";
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-disabled={opening || undefined}
        onClick={() => {
          if (!opening) moments.open(first);
        }}
      >
        <CrateGlyph className="size-4" />
        {opening ? <span className="max-sm:sr-only">Opening…</span> : <ReadyCount count={ready.length} />}
      </Button>
      {attempt !== undefined && attempt !== "opening" && (
        <p className="absolute right-0 top-full mt-1 w-max max-w-64 rounded-md border bg-card px-2 py-1 text-xs font-medium shadow-sm">{attemptMessages[attempt]}</p>
      )}
    </div>
  );
}

function ReadyCount({ count }: { count: number }) {
  return (
    <>
      {count} <span className="max-sm:sr-only">ready</span>
    </>
  );
}
