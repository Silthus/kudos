import { AppLink } from "../AppLink";
import { QuestTag } from "../quests/QuestTag";
import { Claimed } from "../crates/RewardCrate";
import { MaxLine } from "../Max";
import type { QuestsShown } from "../questsRead";
import { questsHref } from "../route";
import type { JourneyStep, QuestSlot } from "../shell";
import { SlackLink } from "../SlackLink";
import { PageLink, Panel } from "./Panel";

const label = { id: "quests", label: "Quests this week", aside: "New quests every Monday.", gameObject: true } as const;

export function QuestsPanel({ quests }: { quests: QuestsShown | undefined }) {
  if (quests === undefined) return <Panel {...label} busy />;
  if (quests.kind === "broken") return <Panel {...label}><PageLink feature="quests" /></Panel>;
  if (quests.kind !== "quests") return null;
  return (
    <Panel {...label}>
      {quests.slots.length === 0 && <NoQuests chatUrl={quests.chatUrl} />}
      <QuestRows slots={quests.slots} bonus={quests.bonus} />
      <PageLink feature="quests" />
    </Panel>
  );
}

function QuestRows({ slots, bonus }: { slots: QuestSlot[]; bonus: JourneyStep | null }) {
  if (slots.length === 0 && bonus === null) return null;
  return (
    <ul className="-mx-2 flex flex-col gap-1">
      {slots.map((slot) => (
        <QuestRow key={slot.slot} slot={slot} />
      ))}
      {bonus !== null && <BonusRow step={bonus} />}
    </ul>
  );
}

function BonusRow({ step: { goal, state } }: { step: JourneyStep }) {
  return (
    <li className="relative flex flex-col gap-1.5 rounded-lg px-2 py-2 hover:bg-fill-hover">
      <AppLink href={questsHref("journey")} className="flex items-start justify-between gap-2 text-sm leading-snug after:absolute after:inset-0 after:rounded-lg">
        <span className="min-w-0 flex-1">{goal}</span>
        <New />
        {state === "finished" && <Claim />}
      </AppLink>
    </li>
  );
}

function New() {
  return (
    <>
      {" "}
      <QuestTag>New</QuestTag>
    </>
  );
}

function QuestRow({ slot: { slot, goal, progress, state } }: { slot: QuestSlot }) {
  const finished = state === "finished";
  return (
    <li className="relative flex flex-col gap-1.5 rounded-lg px-2 py-2 hover:bg-fill-hover">
      <AppLink href={questsHref(finished ? slot : undefined)} className="flex items-start justify-between gap-2 text-sm leading-snug after:absolute after:inset-0 after:rounded-lg">
        <span className="min-w-0">{goal}</span>
        {finished && <Claim />}
      </AppLink>
      {state === "in-progress" && <Progress goal={goal} {...progress} />}
      {state === "opened" && (
        <span className="self-start">
          <Claimed />
        </span>
      )}
    </li>
  );
}

function Claim() {
  return (
    <>
      {" "}
      <span className="shrink-0 text-xs font-semibold">Claim</span>
    </>
  );
}

function Progress({ goal, done, target }: { goal: string } & QuestSlot["progress"]) {
  return (
    <div className="flex items-center gap-2.5">
      <div role="progressbar" aria-label={goal} aria-valuenow={done} aria-valuemin={0} aria-valuemax={target} className="h-1.5 flex-1 overflow-hidden rounded-full border border-muted-foreground">
        <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (done / target) * 100)}%` }} />
      </div>
      <span aria-hidden="true" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{`${done}/${target}`}</span>
    </div>
  );
}

function NoQuests({ chatUrl }: { chatUrl: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <MaxLine>No quests this week yet. New quests arrive every Monday.</MaxLine>
      <SlackLink chatUrl={chatUrl} variant="outline">
        Thank someone in Slack
      </SlackLink>
    </div>
  );
}
