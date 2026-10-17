import { useRef } from "react";
import { usePacks } from "./PacksContext";
import { PackStack } from "./PackStack";

export function PackShelf() {
  const session = usePacks();
  const stack = useRef<HTMLDivElement>(null);
  if (session === undefined) return null;
  return (
    <>
      {session.waiting.length > 0 && <PackStack packs={session.waiting} more={session.more} fanned={session.fanned} stackRef={stack} onFan={session.fan} onPick={session.pick} />}
      {!session.listed && <PackAnnouncement text={session.announcement} />}
    </>
  );
}

export function PackAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" data-testid="pack-announcement" className="sr-only">
      {text}
    </p>
  );
}
