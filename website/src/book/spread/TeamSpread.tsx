import { IconArrowLeft, IconCheck } from "@posthog/icons";
import type { CSSProperties } from "react";
import { AppLink } from "../../AppLink";
import { TeamCrest } from "../../crates/TeamCrest";
import { usePictureFailure } from "../../Face";
import type { Face } from "../../shell";
import { dateWords } from "../dates";
import { HoggieCoin } from "../HoggieCoin";
import { PersonSilhouette } from "../PersonSilhouette";
import { ChapterLabel, Page, rarityNameOf } from "./Page";
import { spreadHrefOf } from "./spreads";
import { firstStickerNumberOf, type TeamPage, type TeamPages, type TeamSlot } from "./teamPages";

type TeamProps = { teams: TeamPages; page: TeamPage; timeZone: string; firstPage: number };

export function TeamSpread({ teams, page, timeZone, firstPage }: TeamProps) {
  const firstNumber = firstStickerNumberOf(teams.pages, page);
  return (
    <>
      <Page side="left" number={firstPage} label={`${page.name} crest`}>
        <AppLink href={spreadHrefOf({ kind: "teams" })} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <IconArrowLeft aria-hidden="true" className="size-4" />
          All teams
        </AppLink>
        <header className="flex items-center gap-4">
          <span className="bk-crest-frame grid size-20 shrink-0 place-items-center bg-foreground/10 sm:size-24">{page.art === null ? <PersonSilhouette className="size-12" /> : <TeamCrest art={page.art} size={64} collected={page.complete} />}</span>
          <div className="min-w-0">
            <ChapterLabel>{page.mine ? "Your group" : page.art === null ? "Group" : "Team"}</ChapterLabel>
            <h2 className="hud-display truncate text-3xl font-bold leading-tight sm:text-4xl">{page.name}</h2>
            <span className="text-xs text-muted-foreground">{page.art === null ? `${page.total} ${page.total === 1 ? "person" : "people"} in the group` : `${page.total} hoggies on the roster`}</span>
          </div>
        </header>
        <CrestPlate page={page} />
        <Notes page={page} timeZone={timeZone} />
      </Page>
      <Page side="right" number={firstPage + 1} label={`${page.name} stickers`}>
        <div className="flex items-baseline justify-between gap-3">
          <ChapterLabel>{page.total === 0 ? "Stickers" : `Stickers ${firstNumber}–${firstNumber + page.total - 1}`}</ChapterLabel>
          <span className="text-xs tabular-nums text-muted-foreground">{`${page.held} of ${page.total} stuck in`}</span>
        </div>
        {page.total === 0 ? (
          <p className="text-sm text-muted-foreground">No one else in this group yet.</p>
        ) : (
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-3">
            {page.slots.map((slot, at) => (
              <li key={slot.key} data-slot={slot.key} data-held={slot.held ? "held" : "missing"}>
                {slot.held ? <StickerCard slot={slot} number={firstNumber + at} timeZone={timeZone} /> : <EmptySlot slot={slot} number={firstNumber + at} />}
              </li>
            ))}
          </ol>
        )}
        {page.complete && <CompleteStamp at={page.completedAt} timeZone={timeZone} />}
      </Page>
    </>
  );
}

function CrestPlate({ page }: { page: TeamPage }) {
  if (page.art === null) return null;
  return (
    <figure className={`bk-crest-plate flex flex-col items-center gap-3 rounded-lg p-6 ${page.complete ? "bg-card/70" : "bk-slot"}`}>
      <span className="bk-crest-hover inline-flex">
        <TeamCrest art={page.art} size={140} collected={page.complete} />
      </span>
      <figcaption className="text-center text-sm">{page.complete ? <span className="font-medium">{`The ${page.name} crest is yours.`}</span> : <span className="text-muted-foreground">{`Find every hoggie on ${page.name}'s roster to earn its crest.`}</span>}</figcaption>
    </figure>
  );
}

function Notes({ page, timeZone }: { page: TeamPage; timeZone: string }) {
  const missing = page.slots.filter((slot) => !slot.held);
  const share = page.total > 0 ? Math.round((page.held / page.total) * 100) : 0;
  const names = missing.map((slot) => slot.name).join(", ");
  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{page.complete ? "Every slot filled" : `${missing.length} still to collect`}</span>
        <span className="tabular-nums text-muted-foreground">{`${page.held}/${page.total}`}</span>
      </div>
      <div role="img" aria-label={`${share}% collected`} className="h-2 overflow-hidden rounded-full border border-muted-foreground p-px">
        <div className="bk-fill h-full rounded-full bg-muted-foreground" style={{ width: `${share}%` }} />
      </div>
      {missing.length > 0 && <p className="text-xs text-muted-foreground">{page.art === null ? `Still to swap thanks with ${names}.` : `Still to find: ${names}.`}</p>}
      {page.completedAt !== null && <p className="text-xs text-muted-foreground">{`Completed ${dateWords(page.completedAt, timeZone)}.`}</p>}
    </div>
  );
}

function tiltOf(key: string) {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 100) / 100 - 0.5) * 3;
}

function StickerCard({ slot, number, timeZone }: { slot: TeamSlot; number: number; timeZone: string }) {
  const tilt = tiltOf(slot.key);
  const facts = slot.heldAt === null ? "Collected" : `Since ${dateWords(slot.heldAt, timeZone)}`;
  return (
    <figure className="bk-sticker flex aspect-[3/4] flex-col" style={{ transform: `rotate(${tilt}deg)`, "--tilt": `${tilt}deg` } as CSSProperties}>
      <div className="bk-sheen relative flex-1 overflow-hidden rounded-[6px] bg-muted">
        <SlotPortrait slot={slot} />
        <span aria-hidden="true" className="hud-display absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-card px-1 text-[11px] font-bold tabular-nums text-foreground shadow-sm">
          {number}
        </span>
        <figcaption className="bk-name-strip absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-semibold leading-tight">{slot.name}</figcaption>
      </div>
      <span className="sr-only">{`Sticker ${number}. ${facts}`}</span>
    </figure>
  );
}

function SlotPortrait({ slot }: { slot: TeamSlot }) {
  if (slot.picture.kind === "hoggie") {
    return (
      <span className="absolute inset-0 grid place-items-center">
        <HoggieCoin art={slot.picture.art} rarity={slot.picture.rarity} size={72} />
      </span>
    );
  }
  return <Portrait face={slot.picture.face} former={slot.picture.former} />;
}

function Portrait({ face, former }: { face: Face; former: boolean }) {
  if (face.kind === "initials") return <PortraitInitials initials={face.initials} />;
  return <PortraitPicture key={face.image} face={face} former={former} />;
}

function PortraitPicture({ face, former }: { face: Exclude<Face, { kind: "initials" }>; former: boolean }) {
  const { failed, picture, onError } = usePictureFailure();
  if (failed) return <PortraitInitials initials={face.initials} />;
  const onColour: CSSProperties | undefined = face.kind === "company-profile" ? { backgroundColor: face.colour } : undefined;
  return <img ref={picture} src={face.image} alt="" loading="lazy" style={onColour} onError={onError} className={`absolute inset-0 size-full object-cover ${face.kind === "company-profile" ? "object-top" : ""} ${former ? "grayscale" : ""}`} />;
}

function PortraitInitials({ initials }: { initials: string }) {
  return <span className="hud-display absolute inset-0 grid place-items-center text-3xl font-bold text-muted-foreground">{initials}</span>;
}

function EmptySlot({ slot, number }: { slot: TeamSlot; number: number }) {
  return (
    <div className="bk-slot flex aspect-[3/4] flex-col items-center justify-center gap-1 p-2 text-center">
      <span aria-hidden="true" className="hud-display text-2xl font-bold tabular-nums text-muted-foreground/70 sm:text-3xl">
        {number}
      </span>
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">{slot.name}</span>
      <span className="text-[10px] leading-tight text-muted-foreground/80">{slot.picture.kind === "hoggie" ? rarityNameOf(slot.picture.rarity) : "Not collected yet"}</span>
      <span className="sr-only">{`Sticker ${number}, empty.`}</span>
    </div>
  );
}

function CompleteStamp({ at, timeZone }: { at: number | null; timeZone: string }) {
  return (
    <div aria-label="Album complete" role="img" className="bk-stamp bk-stamp-in pointer-events-none absolute bottom-10 right-5 flex flex-col items-center px-3 py-1 sm:right-8">
      <span className="hud-display flex items-center gap-1 text-lg font-bold uppercase tracking-wider">
        <IconCheck className="size-4" />
        Complete
      </span>
      {at !== null && <span className="text-[10px] font-semibold uppercase tracking-widest">{dateWords(at, timeZone)}</span>}
    </div>
  );
}
