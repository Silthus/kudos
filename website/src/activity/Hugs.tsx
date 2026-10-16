import { useId, type ReactNode } from "react";
import { CustomEmoji, EmojiName } from "../CustomEmoji";
import type { HugGiven, HugReceived, Message } from "../shell";
import { emojiCharacterOf, withoutSkinTone } from "./emoji";
import type { EntryProps } from "./Entries";
import { OpenInSlack, When } from "./EntryParts";
import { KudosMessage } from "./KudosMessage";
import { Faces, namesOf } from "./People";

export function HugReceivedRow({ entry, ...shown }: { entry: HugReceived } & EntryProps) {
  const what = entry.kudos === null ? "your message" : "the kudos you received";
  return (
    <HugRow side="received" entry={entry} face={<Faces people={entry.givers} faceSize="size-6" />} counts={[hugsOf(entry.hugs), ...xpOf(entry.xp)]} slackName={what} {...shown}>
      {`${whoReacted(entry)} reacted `}
      <ReactedEmoji entry={entry} />
      {` on ${what}`}
    </HugRow>
  );
}

export function HugGivenRow({ entry, ...shown }: { entry: HugGiven } & EntryProps) {
  const what = `${possessive(namesOf(entry.people))} ${entry.kudos === null ? "message" : "kudos"}`;
  return (
    <HugRow side="given" entry={entry} counts={xpOf(entry.xp)} slackName={what} {...shown}>
      {"You reacted "}
      <ReactedEmoji entry={entry} />
      {` on ${what}`}
    </HugRow>
  );
}

type Side = "received" | "given";

type HugRowProps = { side: Side; entry: HugReceived | HugGiven; face?: ReactNode; counts: string[]; slackName: string; children: ReactNode } & EntryProps;

function HugRow({ side, entry, face, counts, slackName, index, timeZone, children }: HugRowProps) {
  const headlineId = useId();
  const given = side === "given";
  return (
    <article
      aria-labelledby={headlineId}
      tabIndex={-1}
      data-entry-index={index}
      data-side={side}
      className={`flex gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring ${given ? "justify-end" : "justify-start"}`}
    >
      {face !== undefined && <div className="shrink-0 pt-px">{face}</div>}
      <div className={`flex max-w-[80%] min-w-0 flex-col gap-1 text-xs text-muted-foreground ${given ? "items-end text-right" : "items-start"}`}>
        <div className="max-w-full px-1 [overflow-wrap:anywhere]">
          <h3 id={headlineId} className="inline font-medium text-foreground/80">
            {children}
          </h3>
          {counts.length > 0 && <span className="tabular-nums">{` · ${counts.join(" · ")}`}</span>}
          <When at={entry.at} timeZone={timeZone} className="ml-2 whitespace-nowrap" />
        </div>
        {entry.kudos !== null && <QuotedKudos kudos={entry.kudos} />}
        {entry.permalink !== null && <OpenInSlack permalink={entry.permalink} name={slackName} className="px-1 text-xs" />}
      </div>
    </article>
  );
}

function QuotedKudos({ kudos }: { kudos: Message }) {
  return (
    <blockquote className="max-w-full border-s-2 border-border px-2 text-left">
      <KudosMessage message={kudos} clamped />
    </blockquote>
  );
}

function ReactedEmoji({ entry: { emoji, emojiImage } }: { entry: HugReceived | HugGiven }) {
  const label = `:${withoutSkinTone(emoji)}:`;
  if (emojiImage !== undefined) return <CustomEmoji key={emojiImage} label={label} image={emojiImage} className="inline h-[1.2em] w-auto align-[-0.25em]" />;
  return emojiCharacterOf(emoji) ?? <EmojiName label={label} />;
}

function whoReacted({ givers, hugs }: HugReceived) {
  const others = hugs - 1;
  if (others <= 1 && givers.length === hugs) return namesOf(givers);
  return `${namesOf(givers.slice(0, 1))} and ${others} ${others === 1 ? "other" : "others"}`;
}

function hugsOf(hugs: number) {
  return `${hugs} ${hugs === 1 ? "hug" : "hugs"}`;
}

function xpOf(xp: number | null) {
  return xp === null ? [] : [`+${xp} XP`];
}

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}
