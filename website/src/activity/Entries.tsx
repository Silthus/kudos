import { IconExternal, IconLock } from "@posthog/icons";
import { useId, type ReactNode } from "react";
import type { ActivityEntry, KudosGiven, KudosReceived, LevelUp, QuestDone } from "../shell";
import { timeOf } from "./days";
import { KudosMessage } from "./KudosMessage";
import { Faces, namesOf } from "./People";

type Bonus = NonNullable<KudosGiven["earned"]>["bonuses"][number];

type EntryProps = { index: number; timeZone: string | undefined };

export function Entry({ entry, ...shown }: { entry: ActivityEntry } & EntryProps) {
  switch (entry.kind) {
    case "kudosReceived":
      return <Received entry={entry} {...shown} />;
    case "kudosGiven":
      return <Given entry={entry} {...shown} />;
    case "levelUp":
      return <LevelMark entry={entry} {...shown} />;
  }
}

function Received({ entry, ...shown }: { entry: KudosReceived } & EntryProps) {
  const giver = entry.giver.name;
  return (
    <KudosEntry face={<Faces people={[entry.giver]} />} headline={`${giver} thanked you`} entry={entry} slackName={`the kudos from ${giver}`} {...shown} />
  );
}

function Given({ entry, ...shown }: { entry: KudosGiven } & EntryProps) {
  const names = namesOf(entry.recipients);
  const each = entry.kudos > 1 ? ` · ${entry.kudos} kudos each` : "";
  return (
    <KudosEntry face={<Faces people={entry.recipients} />} headline={`You thanked ${names}${each}`} entry={entry} slackName={`your kudos to ${names}`} {...shown}>
      {entry.earned !== null && <Earned earned={entry.earned} />}
    </KudosEntry>
  );
}

type KudosEntryProps = { face: ReactNode; headline: string; entry: KudosReceived | KudosGiven; slackName: string; children?: ReactNode } & EntryProps;

function KudosEntry({ face, headline, entry, slackName, index, timeZone, children }: KudosEntryProps) {
  const headlineId = useId();
  return (
    <article aria-labelledby={headlineId} tabIndex={-1} data-entry-index={index} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative z-10 flex justify-center pt-3">{face}</div>
      <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 id={headlineId} className="min-w-0 font-medium [overflow-wrap:anywhere]">
            {headline}
          </h3>
          <When at={entry.at} timeZone={timeZone} />
        </div>
        <KudosMessage message={entry.message} clamped={false} />
        <Tags entry={entry} />
        {children}
        {entry.permalink !== null && <OpenInSlack permalink={entry.permalink} name={slackName} />}
      </div>
    </article>
  );
}

function LevelMark({ entry, index, timeZone }: { entry: LevelUp } & EntryProps) {
  const headlineId = useId();
  return (
    <article aria-labelledby={headlineId} tabIndex={-1} data-entry-index={index} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative z-10 flex justify-center">
        <span aria-hidden="true" className="hud-display flex size-9 items-center justify-center rounded-full border-2 border-foreground/70 bg-background text-base font-bold tabular-nums">
          {entry.level}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-3 py-1 text-sm">
        <h3 id={headlineId} className="font-medium">{`You reached level ${entry.level}`}</h3>
        <When at={entry.at} timeZone={timeZone} />
      </div>
    </article>
  );
}

function When({ at, timeZone }: { at: number; timeZone: string | undefined }) {
  return (
    <time dateTime={new Date(at).toISOString()} className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">
      {timeOf(at, timeZone)}
    </time>
  );
}

const tagLook = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground";

function Tags({ entry }: { entry: KudosReceived | KudosGiven }) {
  const isPrivate = entry.channel.visibility === "private";
  const saidWhy = entry.saidWhy === true;
  if (!isPrivate && !saidWhy) return null;
  return (
    <p className="flex flex-wrap gap-1.5">
      {isPrivate && (
        <span className={tagLook}>
          <IconLock aria-hidden="true" className="size-3" />
          Private channel
        </span>
      )}
      {saidWhy && <span className={tagLook}>Said why</span>}
    </p>
  );
}

function Earned({ earned }: { earned: NonNullable<KudosGiven["earned"]> }) {
  const labelId = useId();
  const lines = [
    ...(earned.xp === null ? [] : [<span key="xp" className="font-medium text-foreground tabular-nums">{`+${earned.xp} XP`}</span>]),
    ...earned.bonuses.map((bonus) => <BonusLine key={`bonus:${bonus.perk.id}`} bonus={bonus} />),
    ...earned.questsDone.map((quest, index) => <QuestLine key={`quest:${index}`} quest={quest} />),
  ];
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t pt-2 text-xs text-muted-foreground">
      <span id={labelId} className="hud-label">
        Earned
      </span>
      <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
        {lines.map((line) => (
          <li key={line.key}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function BonusLine({ bonus }: { bonus: Bonus }) {
  return (
    <>
      <span className="font-medium text-foreground tabular-nums">{`${bonus.perk.name} bonus (+${bonus.xp} XP)`}</span>
      {` · ${bonus.why}`}
    </>
  );
}

function QuestLine({ quest }: { quest: QuestDone }) {
  const goal = quest.kind === "journey" ? `Journey step: ${quest.goal}` : quest.goal;
  return (
    <>
      {`Finished ${goal} · `}
      <span className="font-medium text-foreground tabular-nums">{`+${quest.xp} XP`}</span>
    </>
  );
}

function OpenInSlack({ permalink, name }: { permalink: string; name: string }) {
  return (
    <a href={permalink} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center gap-1 self-start text-xs font-medium underline-offset-4 hover:underline">
      Open in Slack
      <span className="sr-only">{`: ${name} (opens in a new tab)`}</span>
      <IconExternal aria-hidden="true" className="size-3.5" />
    </a>
  );
}
