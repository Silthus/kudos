// Variant E home quest card: this week's quests as a checklist with progress, one claimable quest lifted out, and a link to the quests screen; hidden until quests unlock.
import { IconArrowRight, IconCheckCircle, IconPeople } from "@posthog/icons";
import { Panel } from "./hud";
import { QuestProgress } from "./quests-parts";
import { resetText, useQuests, type Quest } from "./quests-data";
import { usePreviewLevel, useUnlocked } from "./unlocks";

export function QuestCard() {
  const open = useUnlocked("quests");
  const level = usePreviewLevel();
  const { personal, group, fresh } = useQuests(level);
  if (!open) return null;
  const quests = [...personal, ...(fresh ? [fresh] : []), group];
  const claimable = quests.find((q) => q.state === "claimable");
  return (
    <Panel label="Quests this week" action={<span className="text-xs text-muted-foreground">{resetText}</span>}>
      <ul className="flex flex-col gap-1">
        {quests.map((quest) => (
          <QuestRow key={quest.def.id} quest={quest} group={quest === group} highlighted={quest === claimable} />
        ))}
      </ul>
      <a href="#/quests" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        See all quests
        <IconArrowRight className="size-3.5" />
      </a>
    </Panel>
  );
}

function QuestRow({ quest, group, highlighted }: { quest: Quest; group: boolean; highlighted: boolean }) {
  const claimed = quest.state === "claimed";
  return (
    <li>
      <a href={`#/quests/${quest.def.id}`} className={`flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-fill-hover ${highlighted ? "bg-primary/8 ring-1 ring-inset ring-primary/50" : ""}`}>
        <IconCheckCircle className={`mt-0.5 size-4 shrink-0 ${claimed ? "text-success-foreground" : quest.state === "claimable" ? "text-foreground" : "text-muted-foreground/50"}`} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={`flex items-start justify-between gap-2 text-sm leading-snug ${claimed ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>
            <span className="min-w-0">
              {group && <IconPeople className="mr-1 inline size-3.5 align-[-2px] text-muted-foreground" aria-label="Group quest" />}
              {quest.def.goal}
            </span>
            {highlighted && <span className="shrink-0 text-xs font-semibold text-foreground">Claim</span>}
          </span>
          {quest.state === "progress" && <QuestProgress quest={quest} compact />}
        </span>
      </a>
    </li>
  );
}
