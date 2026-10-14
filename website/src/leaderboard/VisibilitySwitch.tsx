import { Switch } from "@posthog/quill";
import { useState } from "react";
import type { ShellActions, VisibilityReply } from "../shell";

type VisibilitySwitchProps = { onTheBoards: boolean; setBoardVisibility: ShellActions["setBoardVisibility"] };

type Outcome = { asked: boolean; reply: VisibilityReply | { kind: "unreachable" } };

export function VisibilitySwitch({ onTheBoards, setBoardVisibility }: VisibilitySwitchProps) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();

  const choose = async (visible: boolean) => {
    setPending(true);
    setOutcome(undefined);
    try {
      setOutcome({ asked: visible, reply: await setBoardVisibility(visible) });
    } catch {
      setOutcome({ asked: visible, reply: { kind: "unreachable" } });
    } finally {
      setPending(false);
    }
  };

  const line = outcome === undefined ? "" : lineAfter(outcome, onTheBoards);

  return (
    <>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        Show me on the leaderboards
        <Switch size="sm" className="data-[unchecked]:border-muted-foreground motion-reduce:transition-none motion-reduce:[&_*]:transition-none" checked={onTheBoards} disabled={pending} onCheckedChange={(visible) => void choose(visible)} />
      </label>
      <p role="status" className={line === "" ? "sr-only" : "text-muted-foreground"}>
        {line}
      </p>
    </>
  );
}

function lineAfter({ asked, reply }: Outcome, onTheBoards: boolean): string {
  switch (reply.kind) {
    case "set":
      return reply.visible === onTheBoards ? settingLine(onTheBoards) : "";
    case "refused":
      return asked === onTheBoards ? "" : "That couldn't be changed.";
    case "unreachable":
      return asked === onTheBoards ? "" : "Couldn't reach HedgeHug. Try again.";
    default:
      return "";
  }
}

function settingLine(onTheBoards: boolean) {
  return onTheBoards ? "You're on the leaderboards." : "You're off the leaderboards.";
}
