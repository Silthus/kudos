import { useLayoutEffect, useRef, type RefObject } from "react";
import type { BoughtCrate } from "../../crates/readyCrates";
import { focusPageTitle } from "../../pageFocus";
import type { ShellActions } from "../../shell";
import { PackLanding } from "./PackLanding";
import { PackScene } from "./PackScene";
import { PackStack } from "./PackStack";
import { usePackSession, type PackSession } from "./usePackSession";

type PackShelfProps = { crates: BoughtCrate[]; openCrate: ShellActions["openCrate"] };

export function PackShelf({ crates, openCrate }: PackShelfProps) {
  const session = usePackSession(crates, openCrate);
  const stack = useRef<HTMLDivElement>(null);
  useFocusBackOnTheStack(session, stack);
  return (
    <>
      {session.waiting.length > 0 && <PackStack crates={session.waiting} fanned={session.fanned} stackRef={stack} onFan={session.fan} onPick={session.pick} />}
      {session.stage.kind === "scene" && <PackScene packs={session.scenePacks} latest={session.latest} revealed={session.revealed} onOpen={session.open} onRevealed={session.reveal} onFinish={session.finish} />}
      {session.stage.kind === "landing" && <PackLanding opened={session.stage.opened} onDone={session.landed} />}
      <p role="status" data-testid="pack-announcement" className="sr-only">
        {session.announcement}
      </p>
    </>
  );
}

function useFocusBackOnTheStack({ stage, returnFocus, focused }: PackSession, stack: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    if (stage.kind !== "stack" || !returnFocus) return;
    const firstPack = stack.current?.querySelector<HTMLElement>("button");
    if (firstPack) firstPack.focus();
    else focusPageTitle();
    focused();
  }, [stage, returnFocus, focused, stack]);
}
