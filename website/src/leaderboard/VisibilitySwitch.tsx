import { Switch } from "@posthog/quill";
import { useState } from "react";
import type { ShellActions, VisibilityReply } from "../shell";

type VisibilitySwitchProps = { onTheBoards: boolean; setBoardVisibility: ShellActions["setBoardVisibility"] };

const unreachable = "Couldn't reach HedgeHug. Try again.";

export function VisibilitySwitch({ onTheBoards, setBoardVisibility }: VisibilitySwitchProps) {
  const [pending, setPending] = useState(false);
  const [said, setSaid] = useState("");

  const choose = async (visible: boolean) => {
    setPending(true);
    setSaid("");
    try {
      setSaid(lineAfter(await setBoardVisibility(visible)));
    } catch {
      setSaid(unreachable);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        Show me on the leaderboards
        <Switch size="sm" checked={onTheBoards} disabled={pending} onCheckedChange={(visible) => void choose(visible)} />
      </label>
      <p role="status" className="text-muted-foreground empty:hidden">
        {said}
      </p>
    </>
  );
}

function lineAfter(reply: VisibilityReply): string {
  if (reply.kind === "set") return reply.visible ? "You're on the leaderboards." : "You're off the leaderboards.";
  if (reply.kind === "refused") return "That couldn't be changed.";
  return "";
}
