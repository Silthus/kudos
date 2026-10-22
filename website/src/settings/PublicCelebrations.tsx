import { Switch } from "@posthog/quill";
import { Panel } from "./Panel";
import type { PublicCelebrationsReply, ShellActions } from "../shell";
import { switchLook } from "./MessageSettingRow";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type PublicCelebrationsProps = { on: boolean; setPublicCelebrations: ShellActions["setPublicCelebrations"] };

const landedLines = { on: "Switched on. Teammates who chose them get them again.", off: "Switched off. Nobody can pick public celebrations until they're switched on again." };

export function PublicCelebrations({ on, setPublicCelebrations }: PublicCelebrationsProps) {
  const { pending, settled, choose } = useSentChoice(on, async (asked: boolean) => answerOf(await setPublicCelebrations(asked)));
  return (
    <Panel id="public-celebrations" label="Public celebrations">
      <p className="text-sm break-words text-muted-foreground">I celebrate teammates' progress in the announcement channel. Each teammate still hears about their own.</p>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold sm:max-w-sm">
        Celebrate in the announcement channel
        <Switch size="sm" className={`${switchLook} shrink-0`} checked={on} disabled={pending} onCheckedChange={(asked) => void choose(asked)} />
      </label>
      <StatusLine line={lineAfter(settled, on ? landedLines.on : landedLines.off)} />
    </Panel>
  );
}

function answerOf(reply: PublicCelebrationsReply): Answer {
  if (reply.kind === "set") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}
