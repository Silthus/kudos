import { Button } from "@posthog/quill";
import { CrateGlyph } from "./CrateArt";
import { attemptMessages, useMoments } from "./moments";
import type { ReadyCrate } from "./readyCrates";

export function ReadyPill({ crates }: { crates: ReadyCrate[] }) {
  const moments = useMoments();
  const first = crates[0];
  if (moments === undefined || first === undefined) return null;
  const opening = moments.attemptOf(first) === "opening";
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
      {opening ? "Opening…" : <ReadyCount count={crates.length} />}
    </Button>
  );
}

export function ReadyPillFailure({ first }: { first: ReadyCrate | undefined }) {
  const moments = useMoments();
  const attempt = first && moments?.attemptOf(first);
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
