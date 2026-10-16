import { IconLock } from "@posthog/icons";
import { useId, type ReactNode } from "react";
import { HoggieCoin } from "../book/HoggieCoin";
import { rarityWordsOf } from "../crates/drops";
import { TeamCrest } from "../crates/TeamCrest";
import type { ActivityEntry, Found, KudosGiven, KudosReceived, LevelUp, QuestDone } from "../shell";
import { OpenInSlack, When } from "./EntryParts";
import { HugGivenRow, HugReceivedRow } from "./Hugs";
import { KudosMessage } from "./KudosMessage";
import { Faces, namesOf } from "./People";

type Bonus = NonNullable<KudosGiven["earned"]>["bonuses"][number];

export type EntryProps = { index: number; timeZone: string | undefined };

export function Entry({ entry, ...shown }: { entry: ActivityEntry } & EntryProps) {
  switch (entry.kind) {
    case "kudosReceived":
      return <Received entry={entry} {...shown} />;
    case "kudosGiven":
      return <Given entry={entry} {...shown} />;
    case "levelUp":
      return <LevelMark entry={entry} {...shown} />;
    case "found":
      return <FoundMark entry={entry} {...shown} />;
    case "hugReceived":
      return <HugReceivedRow entry={entry} {...shown} />;
    case "hugGiven":
      return <HugGivenRow entry={entry} {...shown} />;
  }
}

function Received({ entry, ...shown }: { entry: KudosReceived } & EntryProps) {
  const giver = entry.giver.name;
  return <KudosEntry side="received" headline={`${giver} thanked you`} face={<Faces people={[entry.giver]} />} entry={entry} slackName={`the kudos from ${giver}`} {...shown} />;
}

function Given({ entry, ...shown }: { entry: KudosGiven } & EntryProps) {
  const names = namesOf(entry.recipients);
  const each = entry.kudos > 1 ? ` · ${entry.kudos} kudos each` : "";
  return (
    <KudosEntry side="given" headline={`You thanked ${names}${each}`} entry={entry} slackName={`your kudos to ${names}`} {...shown}>
      <div className="flex flex-col items-end gap-1.5 px-1">
        <Faces people={entry.recipients} />
        {entry.earned !== null && <Earned earned={entry.earned} />}
      </div>
    </KudosEntry>
  );
}

type Side = "received" | "given";

const bubbleLook: Record<Side, string> = {
  received: "rounded-2xl rounded-tl-md border bg-card shadow-xs",
  given: "rounded-2xl rounded-tr-md border border-primary/40 bg-primary/12",
};

type KudosEntryProps = { side: Side; headline: string; face?: ReactNode; entry: KudosReceived | KudosGiven; slackName: string; children?: ReactNode } & EntryProps;

function KudosEntry({ side, headline, face, entry, slackName, index, timeZone, children }: KudosEntryProps) {
  const headlineId = useId();
  const given = side === "given";
  return (
    <article
      aria-labelledby={headlineId}
      tabIndex={-1}
      data-entry-index={index}
      data-side={side}
      className={`flex gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring ${given ? "justify-end" : "justify-start"}`}
    >
      {face !== undefined && <div className="shrink-0 pt-6">{face}</div>}
      <div className={`flex max-w-[80%] min-w-0 flex-col gap-1.5 ${given ? "items-end text-right" : "items-start"}`}>
        <div className="max-w-full px-1 text-xs [overflow-wrap:anywhere]">
          <h3 id={headlineId} className="inline font-medium">
            {headline}
          </h3>
          <When at={entry.at} timeZone={timeZone} className="ml-2 whitespace-nowrap" />
        </div>
        <div className={`max-w-full px-4 py-2.5 text-left text-sm ${bubbleLook[side]}`}>
          <KudosMessage message={entry.message} clamped={false} />
        </div>
        {children}
        <Footnotes side={side} entry={entry} slackName={slackName} />
      </div>
    </article>
  );
}

function LevelMark({ entry, index, timeZone }: { entry: LevelUp } & EntryProps) {
  const headlineId = useId();
  return (
    <article aria-labelledby={headlineId} tabIndex={-1} data-entry-index={index} data-side="centre" className="flex items-center gap-3 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span aria-hidden="true" className="hud-display flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground/50 bg-background text-base font-bold tabular-nums">
        {entry.level}
      </span>
      <div className="flex shrink-0 flex-col text-sm">
        <h3 id={headlineId} className="font-medium">{`You reached level ${entry.level}`}</h3>
        <When at={entry.at} timeZone={timeZone} />
      </div>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </article>
  );
}

function FoundMark({ entry: { at, drop }, index, timeZone }: { entry: Found } & EntryProps) {
  const headlineId = useId();
  const found = `You found a ${rarityWordsOf(drop.rarity)} ${drop.name}`;
  return (
    <article aria-labelledby={headlineId} tabIndex={-1} data-entry-index={index} data-side="centre" data-rarity={drop.rarity} className="flex items-center gap-3 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <HoggieCoin art={drop.art} rarity={drop.rarity} size={44} />
      {drop.crest && <TeamCrest art={drop.crest.art} size={44} />}
      <div className="flex min-w-0 flex-col text-sm">
        <h3 id={headlineId} className="font-medium">
          {drop.crest ? `${found} and completed ${drop.crest.name}` : found}
        </h3>
        <span className="flex items-center gap-2">
          <When at={at} timeZone={timeZone} />
          {drop.copy > 1 && <span className="text-xs text-muted-foreground tabular-nums">{`×${drop.copy}`}</span>}
        </span>
      </div>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </article>
  );
}

const tagLook = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground";

function Footnotes({ side, entry, slackName }: { side: Side; entry: KudosReceived | KudosGiven; slackName: string }) {
  const isPrivate = entry.channel.visibility === "private";
  const saidWhy = entry.saidWhy === true;
  if (!isPrivate && !saidWhy && entry.permalink === null) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 ${side === "given" ? "justify-end" : ""}`}>
      {isPrivate && (
        <span className={tagLook}>
          <IconLock aria-hidden="true" className="size-3" />
          Private channel
        </span>
      )}
      {saidWhy && <span className={tagLook}>Said why</span>}
      {entry.permalink !== null && <OpenInSlack permalink={entry.permalink} name={slackName} />}
    </div>
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
    <div className="flex flex-col gap-0.5 pt-1 text-xs text-muted-foreground">
      <span id={labelId} className="font-medium">
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
      <span className="tabular-nums">{`${bonus.perk.name} bonus (+${bonus.xp} XP)`}</span>
      {` · ${bonus.why}`}
    </>
  );
}

function QuestLine({ quest }: { quest: QuestDone }) {
  const goal = quest.kind === "journey" ? `Journey step: ${quest.goal}` : quest.goal;
  return (
    <>
      {`Finished ${goal} · `}
      <span className="tabular-nums">{`+${quest.xp} XP`}</span>
    </>
  );
}
