import { IconArrowLeft, IconCheck } from "@posthog/icons";
import { useState, type CSSProperties } from "react";
import { AppLink } from "../../AppLink";
import { TeamCrest } from "../../crates/TeamCrest";
import { usePictureFailure } from "../../Face";
import type { Face } from "../../shell";
import { dateWords } from "../dates";
import { HoggieCoin } from "../HoggieCoin";
import { PersonSilhouette } from "../PersonSilhouette";
import { ChapterLabel, Page, rarityNameOf } from "./Page";
import { spreadHrefOf } from "./spreads";
import { crestEarnedOn, firstStickerNumberOf, type TeamPage, type TeamPages, type TeamSlot } from "./teamPages";

type TeamProps = { teams: TeamPages; page: TeamPage; timeZone: string; firstPage: number; matchingHref: string | null };

const sheetSize = 12;

const namesShown = 6;

export function TeamSpread({ teams, page, timeZone, firstPage, matchingHref }: TeamProps) {
  const firstNumber = firstStickerNumberOf(teams.pages, page);
  const sheet = useSheet(page);
  return (
    <>
      <Page side="left" number={firstPage} label={`${page.name} crest`}>
        <AppLink href={spreadHrefOf({ kind: "teams" })} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <IconArrowLeft aria-hidden="true" className="size-4" />
          All teams
        </AppLink>
        <header className="flex items-center gap-4">
          <span className="bk-crest-frame grid size-20 shrink-0 place-items-center bg-foreground/10 sm:size-24">{page.art === null && page.source !== "team" ? <PersonSilhouette className="size-12" /> : <TeamCrest art={page.art} size={64} collected={crestEarnedOn(page)} name={page.name} />}</span>
          <div className="min-w-0">
            <ChapterLabel>{kindWordsOf(page)}</ChapterLabel>
            <h2 className="hud-display truncate text-3xl font-bold leading-tight sm:text-4xl">{page.name}</h2>
            <span className="text-xs text-muted-foreground">{sizeWordsOf(page)}</span>
          </div>
        </header>
        <CrestPlate page={page} />
        <Notes page={page} timeZone={timeZone} />
      </Page>
      <Page side="right" number={firstPage + 1} label={`${page.name} stickers`}>
        <div className="flex items-baseline justify-between gap-3">
          <ChapterLabel>{page.total === 0 ? "Stickers" : `Stickers ${firstNumber + sheet.from}–${firstNumber + sheet.to - 1}`}</ChapterLabel>
          <span className="text-xs tabular-nums text-muted-foreground">{`${page.held} of ${page.total} stuck in`}</span>
        </div>
        {page.total === 0 ? (
          <p className="text-sm text-muted-foreground">{page.source === "team" ? "No one to collect on this team yet." : "No one else in this group yet."}</p>
        ) : (
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-3">
            {page.slots.slice(sheet.from, sheet.to).map((slot, at) => (
              <li key={slot.key} data-slot={slot.key} data-held={slot.held ? "held" : "missing"}>
                {slot.held ? <StickerCard slot={slot} number={firstNumber + sheet.from + at} timeZone={timeZone} /> : <EmptySlot slot={slot} number={firstNumber + sheet.from + at} />}
              </li>
            ))}
          </ol>
        )}
        {sheet.count > 1 && <SheetTurner sheet={sheet} />}
        {page.unmatched.length > 0 && <Unmatched page={page} matchingHref={matchingHref} />}
        {page.complete && <CompleteStamp at={page.source === "team" ? null : page.completedAt} timeZone={timeZone} />}
      </Page>
    </>
  );
}

type Sheet = { at: number; count: number; from: number; to: number; turn: (to: number) => void };

function useSheet(page: TeamPage): Sheet {
  const [at, turn] = useState(0);
  const count = page.source === "team" ? Math.max(1, Math.ceil(page.total / sheetSize)) : 1;
  const shown = Math.min(at, count - 1);
  const from = page.source === "team" ? shown * sheetSize : 0;
  return { at: shown, count, from, to: page.source === "team" ? Math.min(page.total, from + sheetSize) : page.total, turn };
}

function SheetTurner({ sheet }: { sheet: Sheet }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <SheetButton label="← Previous sheet" to={sheet.at - 1} sheet={sheet} />
      <span aria-live="polite" className="tabular-nums">{`Sheet ${sheet.at + 1} of ${sheet.count}`}</span>
      <SheetButton label="Next sheet →" to={sheet.at + 1} sheet={sheet} />
    </div>
  );
}

function SheetButton({ label, to, sheet }: { label: string; to: number; sheet: Sheet }) {
  const open = to >= 0 && to < sheet.count;
  return (
    <button type="button" aria-disabled={!open} onClick={() => open && sheet.turn(to)} className={`rounded-md px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${open ? "hover:bg-fill-hover" : "text-muted-foreground/50"}`}>
      {label}
    </button>
  );
}

function kindWordsOf(page: TeamPage) {
  if (page.source === "team") return page.mine ? "Your team" : "Team";
  return page.mine ? "Your group" : page.art === null ? "Group" : "Team";
}

function sizeWordsOf(page: TeamPage) {
  if (page.source === "team") return `${page.total} ${page.total === 1 ? "person" : "people"} to collect${page.leads.length === 0 ? "" : ` · led by ${page.leads.join(", ")}`}`;
  return page.art === null ? `${page.total} ${page.total === 1 ? "person" : "people"} in the group` : `${page.total} hoggies on the roster`;
}

function CrestPlate({ page }: { page: TeamPage }) {
  if (page.art === null && page.source !== "team") return null;
  const earned = crestEarnedOn(page);
  return (
    <figure className={`bk-crest-plate flex flex-col items-center gap-3 rounded-lg p-6 ${earned ? "bg-card/70" : "bk-slot"}`}>
      <span className="bk-crest-hover inline-flex">
        <TeamCrest art={page.art} size={140} collected={earned} name={page.name} />
      </span>
      <figcaption className="text-center text-sm">{earned ? <span className="font-medium">{`The ${page.name} crest is yours.`}</span> : <span className="text-muted-foreground">{page.source === "team" ? `Collect everyone on ${page.name} to earn its crest.` : `Find every hoggie on ${page.name}'s roster to earn its crest.`}</span>}</figcaption>
    </figure>
  );
}

function Notes({ page, timeZone }: { page: TeamPage; timeZone: string }) {
  const missing = page.slots.filter((slot) => !slot.held);
  const share = page.total > 0 ? Math.round((page.held / page.total) * 100) : 0;
  const names = namesWordsOf(missing.map((slot) => slot.name), page.source === "team");
  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{page.complete ? "Every slot filled" : `${missing.length} still to collect`}</span>
        <span className="tabular-nums text-muted-foreground">{`${page.held}/${page.total}`}</span>
      </div>
      <div role="img" aria-label={`${share}% collected`} className="h-2 overflow-hidden rounded-full border border-muted-foreground p-px">
        <div className="bk-fill h-full rounded-full bg-muted-foreground" style={{ width: `${share}%` }} />
      </div>
      {missing.length > 0 && <p className="text-xs text-muted-foreground">{page.source === "roster" ? `Still to find: ${names}.` : `Still to swap thanks with ${names}.`}</p>}
      {page.completedAt !== null && <p className="text-xs text-muted-foreground">{`${page.source === "team" ? "Collected" : "Completed"} ${dateWords(page.completedAt, timeZone)}.`}</p>}
    </div>
  );
}

function namesWordsOf(names: string[], capped: boolean) {
  const shown = capped ? names.slice(0, namesShown) : names;
  const more = names.length - shown.length;
  return more === 0 ? shown.join(", ") : `${shown.join(", ")} and ${more} more`;
}

function Unmatched({ page, matchingHref }: { page: TeamPage; matchingHref: string | null }) {
  const count = page.unmatched.length;
  const names = namesWordsOf(
    page.unmatched.map(({ name }) => name),
    true,
  );
  return (
    <p className="text-xs text-muted-foreground">
      {`${count} ${count === 1 ? "person" : "people"} on this team ${count === 1 ? "isn't" : "aren't"} linked to a teammate yet: ${names}.`}
      {matchingHref !== null && (
        <>
          {" "}
          <AppLink href={matchingHref} className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Match them in Settings
          </AppLink>
        </>
      )}
    </p>
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
        {slot.lead && <LeadMarker />}
        <NameStrip slot={slot} />
      </div>
      <span className="sr-only">{`Sticker ${number}. ${facts}`}</span>
    </figure>
  );
}

function NameStrip({ slot }: { slot: TeamSlot }) {
  if (slot.role === null) return <figcaption className="bk-name-strip absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-semibold leading-tight">{slot.name}</figcaption>;
  return (
    <figcaption className="bk-name-strip absolute inset-x-0 bottom-0 flex flex-col px-1.5 py-1 text-center leading-tight">
      <span className="truncate text-[11px] font-semibold">{slot.name}</span>
      <span className="truncate text-[9px] font-medium opacity-80">{slot.role}</span>
    </figcaption>
  );
}

function LeadMarker() {
  return <span className="absolute right-1 top-1 rounded-full bg-card px-1.5 text-[9px] font-bold uppercase tracking-wider text-foreground shadow-sm">Lead</span>;
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
  if (slot.picture.kind === "face" && slot.role !== null) return <EmptyPersonSlot slot={slot} number={number} />;
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

function EmptyPersonSlot({ slot, number }: { slot: TeamSlot; number: number }) {
  return (
    <div className="bk-slot relative flex aspect-[3/4] flex-col items-center justify-center gap-1 p-2 text-center">
      <PersonSilhouette className="size-8" />
      <span aria-hidden="true" className="hud-display text-lg font-bold tabular-nums text-muted-foreground/70">
        {number}
      </span>
      {slot.lead && <LeadMarker />}
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">{slot.name}</span>
      <span className="text-[10px] leading-tight text-muted-foreground/80">{slot.role}</span>
      <span className="text-[10px] leading-tight text-muted-foreground/80">Not collected yet</span>
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
