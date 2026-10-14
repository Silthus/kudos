import { Switch } from "@posthog/quill";
import { useState } from "react";
import type { ShellActions, VisibilityReply } from "../shell";

type VisibilitySwitchProps = { onTheBoards: boolean; setBoardVisibility: ShellActions["setBoardVisibility"] };

type Outcome = { asked: boolean; reply: VisibilityReply | { kind: "unreachable" } };

const switchLook = [
  "data-[unchecked]:border-muted-foreground data-[unchecked]:[&_[data-slot=switch-thumb]]:bg-foreground",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
  "motion-reduce:transition-none motion-reduce:[&_*]:transition-none",
].join(" ");

export function VisibilitySwitch({ onTheBoards, setBoardVisibility }: VisibilitySwitchProps) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  const [readShown, setReadShown] = useState(onTheBoards);

  if (readShown !== onTheBoards) {
    setReadShown(onTheBoards);
    if (outcome !== undefined && isPast(outcome, onTheBoards)) setOutcome(undefined);
  }

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
        <Switch size="sm" className={switchLook} checked={onTheBoards} disabled={pending} onCheckedChange={(visible) => void choose(visible)} />
      </label>
      <p role="status" className={line === "" ? "sr-only" : "text-muted-foreground"}>
        {line}
      </p>
    </>
  );
}

function isPast({ asked, reply }: Outcome, onTheBoards: boolean) {
  return reply.kind === "set" ? reply.visible !== onTheBoards : asked === onTheBoards;
}

function lineAfter(outcome: Outcome, onTheBoards: boolean): string {
  if (outcome.reply.kind === "set") return outcome.reply.visible === onTheBoards ? settingLine(onTheBoards) : "";
  if (isPast(outcome, onTheBoards)) return "";
  if (outcome.reply.kind === "refused") return "That couldn't be changed.";
  if (outcome.reply.kind === "unreachable") return "Couldn't reach HedgeHug. Try again.";
  return "";
}

function settingLine(onTheBoards: boolean) {
  return onTheBoards ? "You're on the leaderboards." : "You're off the leaderboards.";
}
