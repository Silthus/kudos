import { tierWords } from "../book/dates";
import { Medal } from "../book/Medal";
import { OwnFace } from "../OwnFace";
import type { ProfileCardShown } from "../profileCardRead";
import type { Medal as CardMedal, MemberProfile } from "../shell";
import { Panel } from "./Panel";

export function ProfileCardPanel({ member, card }: { member: MemberProfile; card: ProfileCardShown | undefined }) {
  const medals = card?.kind === "card" ? card.medals : [];
  const group = card?.kind === "card" ? card.group : null;
  const avatar = card?.kind === "card" ? card.avatar : undefined;
  return (
    <Panel id="profile-card" label="What teammates see" aside="Public" busy={card === undefined}>
      <div className="flex flex-col gap-3 rounded-lg border bg-linear-to-br from-card to-muted p-3 shadow-md">
        <div className="flex items-center gap-3">
          <OwnFace face={member.face} avatar={avatar} className="size-14 [--avatar-ring:3px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-lg leading-tight font-semibold">{member.name ?? "You"}</span>
              {member.progression !== null && <LevelTag level={member.progression.level} />}
            </div>
            {group !== null && <span className="truncate text-xs text-muted-foreground">{group}</span>}
          </div>
        </div>
        {medals.length > 0 && <BestMedals medals={medals} />}
      </div>
      <p className="text-xs text-muted-foreground">Everyone can see this card. Your XP and the kudos you receive stay with you.</p>
      <MedalsNote member={member} card={card} />
    </Panel>
  );
}

function LevelTag({ level }: { level: number }) {
  return (
    <span className="shrink-0 text-sm font-semibold tabular-nums">
      <span aria-hidden="true">{`Lv ${level}`}</span>
      <span className="sr-only">{`Level ${level}`}</span>
    </span>
  );
}

function BestMedals({ medals }: { medals: CardMedal[] }) {
  return (
    <ul aria-label="Best medals" className="flex flex-col gap-1.5 border-t pt-3">
      {medals.map(({ ladder, tier, name }) => (
        <li key={ladder} className="flex items-center gap-2.5">
          <Medal tier={tier} earned />
          <span className="min-w-0 flex-1 text-sm leading-tight font-medium">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{tierWords[tier]}</span>
        </li>
      ))}
    </ul>
  );
}

function MedalsNote({ member, card }: { member: MemberProfile; card: ProfileCardShown | undefined }) {
  if (card?.kind === "broken") return <p className="text-xs text-muted-foreground">Your medals didn't load.</p>;
  if (card?.kind === "card" && medalsWaitForTheBook(member)) return <p className="text-xs text-muted-foreground">Medals join this card only after you open the Book.</p>;
  return null;
}

function medalsWaitForTheBook({ features }: MemberProfile) {
  const book = features?.find(({ feature }) => feature === "book");
  return book !== undefined && book.state !== "open";
}
