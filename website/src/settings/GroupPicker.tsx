import { IconChevronDown } from "@posthog/icons";
import type { GroupChoice, GroupPickReply, ShellActions } from "../shell";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type GroupPickerProps = { choice: GroupChoice; pickPrimaryGroup: ShellActions["pickPrimaryGroup"] };

export function GroupPicker({ choice: { primary, groups }, pickPrimaryGroup }: GroupPickerProps) {
  const { pending, settled, choose } = useSentChoice<string>(primary.group, async (group) => answerOf(await pickPrimaryGroup(group)));
  return (
    <>
      <label className="relative flex flex-col gap-1 sm:max-w-xs">
        <span className="text-sm font-medium">The group you count for</span>
        <select
          value={primary.group}
          disabled={pending}
          onChange={(event) => void choose(event.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-muted-foreground bg-card pl-3 pr-9 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {groups.map(({ group, name }) => (
            <option key={group} value={group}>
              {name}
            </option>
          ))}
        </select>
        <IconChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 size-4 text-muted-foreground" />
      </label>
      <StatusLine line={lineAfter(settled, `You count for ${primary.name}.`)} />
    </>
  );
}

function answerOf(reply: GroupPickReply): Answer {
  if (reply.kind === "picked") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}
