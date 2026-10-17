import { useLayoutEffect } from "react";
import { focusPageTitle } from "../../pageFocus";
import type { MemberProfile } from "../../shell";
import { PackLanding } from "./PackLanding";
import { PackScene } from "./PackScene";
import { PackAnnouncement } from "./PackShelf";
import type { PackSession } from "./usePackSession";

type PackMomentsProps = { session: PackSession; shown: MemberProfile | undefined };

export function PackMoments({ session, shown }: PackMomentsProps) {
  useFocusBackOnTheStack(session);
  if (shown === undefined) return null;
  return (
    <>
      {session.stage.kind === "scene" && <PackScene packs={session.scenePacks} latest={session.latest} revealed={session.revealed} onOpen={session.open} onRevealed={session.reveal} onFinish={session.finish} />}
      {session.stage.kind === "landing" && <PackLanding opened={session.stage.opened} shown={shown} onRewardLanded={session.rewardLanded} onDone={session.landed} />}
      {session.announces && <PackAnnouncement text={session.announcement} />}
    </>
  );
}

function useFocusBackOnTheStack({ stage, returnFocus, focused }: PackSession) {
  useLayoutEffect(() => {
    if (stage.kind !== "stack" || !returnFocus) return;
    const firstPack = document.querySelector<HTMLElement>("main .pk-stack button");
    if (firstPack) firstPack.focus();
    else focusPageTitle();
    focused();
  }, [stage, returnFocus, focused]);
}
