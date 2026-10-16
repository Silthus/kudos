import { IconArrowLeft, IconCheck, IconLock } from "@posthog/icons";
import type { CSSProperties, ReactNode } from "react";
import { TeamCrest } from "../../crates/TeamCrest";
import { MemberFace } from "../../Face";
import type { Face } from "../../shell";
import { QuietBar } from "../Bar";
import { dateWords } from "../dates";
import { PersonSilhouette } from "../PersonSilhouette";
import { Tag } from "../Tag";
import { chapterHref } from "./chapters";
import { teamAlbums, type TeamAlbum, type TeamPerson } from "./teamFixtures";

type TeamsProps = { fresh: ReadonlySet<string>; timeZone: string };

export function TeamsChapter({ fresh, timeZone }: TeamsProps) {
  const mine = teamAlbums.filter((album) => album.mine);
  const started = teamAlbums.filter((album) => !album.mine && album.held > 0);
  const untouched = teamAlbums.filter((album) => !album.mine && album.held === 0);
  return (
    <div className="bk-rise flex flex-col gap-8">
      <AlbumGroup title="Your teams" aside="The teams posthog.com lists you on" albums={mine} fresh={fresh} timeZone={timeZone} />
      <AlbumGroup title="Pages started" aside={`${started.length} teams with at least one sticker`} albums={started} fresh={fresh} timeZone={timeZone} />
      <section aria-labelledby="untouched" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="untouched" className="hud-display text-xl font-bold leading-tight">
            Not started
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">{`${untouched.length} teams · thank anyone on them to start a page`}</span>
        </div>
        <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {untouched.map((album) => (
            <li key={album.team}>
              <a href={chapterHref({ kind: "team", team: album.team })} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <TeamCrest art={album.art} size={32} collected={false} />
                <span className="min-w-0 flex-1 truncate text-sm">{album.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{`0 of ${album.total}`}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AlbumGroup({ title, aside, albums, fresh, timeZone }: { title: string; aside: string; albums: TeamAlbum[] } & TeamsProps) {
  if (albums.length === 0) return null;
  return (
    <section aria-labelledby={`group-${title}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`group-${title}`} className="hud-display text-xl font-bold leading-tight">
          {title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{aside}</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {albums.map((album) => (
          <AlbumCover key={album.team} album={album} fresh={album.seen !== null && fresh.has(album.seen)} timeZone={timeZone} />
        ))}
      </ul>
    </section>
  );
}

function AlbumCover({ album, fresh, timeZone }: { album: TeamAlbum; fresh: boolean; timeZone: string }) {
  const complete = album.collectedAt !== null;
  return (
    <li>
      <a href={chapterHref({ kind: "team", team: album.team })} className="bk-album-cover bk-paper relative flex h-full flex-col gap-3 rounded-xl border p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <div className="flex items-center gap-3">
          <span className="bk-crest-frame grid size-14 shrink-0 place-items-center bg-foreground/10">
            <TeamCrest art={album.art} size={44} collected={album.held > 0} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="hud-display truncate text-lg font-bold leading-tight">{album.name}</span>
            <span className="text-xs text-muted-foreground">{album.mine ? "Your team" : `${album.total} people`}</span>
          </span>
          <span className="text-sm font-semibold tabular-nums">{complete ? <IconCheck aria-label="Complete" className="size-5" /> : `${album.held}/${album.total}`}</span>
        </div>
        <QuietBar value={album.held} max={album.total} />
        <ul aria-hidden="true" className="flex flex-wrap gap-1.5">
          {album.people.map((person) => (
            <li key={person.key} title={person.name}>
              {person.held ? <MemberFace face={person.face} className="size-8" /> : <PersonSilhouette className="size-8" />}
            </li>
          ))}
        </ul>
        <span className="sr-only">{rosterWordsOf(album.people)}</span>
        {complete && album.collectedAt !== null && <span className="text-[11px] text-muted-foreground">{`Crest earned ${dateWords(album.collectedAt, timeZone)}`}</span>}
        {fresh && <Tag className="absolute -left-1 -top-1">New</Tag>}
      </a>
    </li>
  );
}

function rosterWordsOf(people: TeamPerson[]) {
  const names = (shown: TeamPerson[]) => shown.map(({ name }) => name).join(", ");
  const held = people.filter((person) => person.held);
  const missing = people.filter((person) => !person.held);
  if (missing.length === 0) return `Everyone collected: ${names(held)}.`;
  return held.length === 0 ? `Still missing: ${names(missing)}.` : `Collected: ${names(held)}. Still missing: ${names(missing)}.`;
}

export function TeamSpread({ team, timeZone }: { team: string; timeZone: string }) {
  const album = teamAlbums.find((entry) => entry.team === team);
  if (album === undefined) return <p className="text-sm text-muted-foreground">No such team page.</p>;
  const spread = teamAlbums.indexOf(album) * 2 + 2;
  const firstNumber = 1 + teamAlbums.slice(0, teamAlbums.indexOf(album)).reduce((sum, entry) => sum + entry.total, 0);
  const complete = album.collectedAt !== null;
  return (
    <div className="bk-rise flex flex-col gap-4">
      <a href={chapterHref({ kind: "teams" })} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <IconArrowLeft aria-hidden="true" className="size-4" />
        All teams
      </a>
      <article className="bk-book grid overflow-hidden lg:grid-cols-2" aria-label={`${album.name} album`}>
        <section className="bk-paper bk-page-left flex flex-col gap-5 p-5 sm:p-7">
          <header className="flex items-center gap-4">
            <span className="bk-crest-frame relative grid size-20 shrink-0 place-items-center bg-foreground/10 sm:size-24">
              <span className="bk-crest-frame absolute inset-1 bg-card/70" aria-hidden="true" />
              <TeamCrest art={album.art} size={64} collected={complete || album.held > 0} />
            </span>
            <div className="min-w-0">
              <span className="hud-label">{album.mine ? "Your team" : "Team"}</span>
              <h2 className="hud-display truncate text-3xl font-bold leading-tight sm:text-4xl">{album.name}</h2>
              <span className="text-xs text-muted-foreground">{`${album.total} people on posthog.com${album.lead === null ? "" : ` · led by ${album.lead}`}`}</span>
            </div>
          </header>
          <CrestPlate album={album} complete={complete} />
          <Notes album={album} className="mt-auto hidden lg:flex" timeZone={timeZone} />
          <PageNumber n={spread} side="left" />
        </section>
        <section className="bk-paper bk-page-right relative flex flex-col gap-4 p-5 pt-2 sm:p-7 lg:pt-7">
          <div className="flex items-baseline justify-between gap-3">
            <span className="hud-label">{`Stickers ${firstNumber}–${firstNumber + album.total - 1}`}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{`${album.held} of ${album.total} stuck in`}</span>
          </div>
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-3">
            {album.people.map((person, at) => (
              <li key={person.key}>{person.held ? <StickerCard person={person} number={firstNumber + at} tilt={tiltOf(person.key)} timeZone={timeZone} /> : <EmptySlot person={person} number={firstNumber + at} />}</li>
            ))}
          </ol>
          {album.unmatched > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <IconLock aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {`${album.unmatched} ${album.unmatched === 1 ? "person" : "people"} on this team ${album.unmatched === 1 ? "isn't" : "aren't"} matched to Slack yet, so there's no sticker to collect.`}
            </p>
          )}
          <Notes album={album} className="mt-2 flex lg:hidden" timeZone={timeZone} />
          {complete && <CompleteStamp at={album.collectedAt!} timeZone={timeZone} />}
          <PageNumber n={spread + 1} side="right" />
        </section>
      </article>
    </div>
  );
}

function CrestPlate({ album, complete }: { album: TeamAlbum; complete: boolean }) {
  return (
    <figure className={`flex flex-col items-center gap-3 rounded-lg p-6 ${complete ? "bg-card/70" : "bk-slot"}`}>
      <TeamCrest art={album.art} size={140} collected={complete} />
      <figcaption className="text-center text-sm">
        {complete ? (
          <span className="font-medium">{`The ${album.name} crest is yours.`}</span>
        ) : (
          <span className="text-muted-foreground">{`Collect everyone on ${album.name} to earn its crest.`}</span>
        )}
      </figcaption>
    </figure>
  );
}

function Notes({ album, className, timeZone }: { album: TeamAlbum; className: string; timeZone: string }) {
  const missing = album.people.filter((person) => !person.held);
  const share = album.total > 0 ? Math.round((album.held / album.total) * 100) : 0;
  return (
    <div className={`flex-col gap-3 ${className}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{album.collectedAt !== null ? "Every page filled" : `${missing.length} still to collect`}</span>
          <span className="tabular-nums text-muted-foreground">{`${album.held}/${album.total}`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border" role="img" aria-label={`${share}% collected`}>
          <div className={`h-full rounded-full ${album.collectedAt !== null ? "bg-foreground" : "bg-foreground/60"}`} style={{ width: `${share}%` }} />
        </div>
        {missing.length > 0 && <p className="text-xs text-muted-foreground">{`Still to swap thanks with ${missing.map((person) => person.name).join(", ")}.`}</p>}
        {album.collectedAt !== null && <p className="text-xs text-muted-foreground">{`Completed ${dateWords(album.collectedAt, timeZone)}.`}</p>}
      </div>
      <p className="text-xs text-muted-foreground">Every team on posthog.com has a page. Its stickers are the team's people: thank one of them, or be thanked, and their sticker sticks. Collect the whole team and the crest is yours for good.</p>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <IconLock aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        <span>Your stickers are yours to keep. Only you can see them.</span>
      </p>
    </div>
  );
}

function tiltOf(key: string) {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 100) / 100 - 0.5) * 3;
}

function StickerCard({ person, number, tilt, timeZone }: { person: TeamPerson; number: number; tilt: number; timeZone: string }) {
  const facts = person.heldAt === null ? "Collected" : `Since ${dateWords(person.heldAt, timeZone)}`;
  return (
    <figure className="bk-sticker flex aspect-[3/4] flex-col" style={{ transform: `rotate(${tilt}deg)` }} title={`${person.name}. ${facts}`}>
      <div className="bk-sheen relative flex-1 overflow-hidden rounded-[6px] bg-muted">
        <Portrait face={person.face} />
        <span className="hud-display absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-card px-1 text-[11px] font-bold tabular-nums text-foreground shadow-sm">{number}</span>
        {person.lead && <span className="absolute right-1 top-1 rounded-full bg-card px-1.5 text-[9px] font-bold uppercase tracking-wider text-foreground shadow-sm">Lead</span>}
        <figcaption className="bk-name-strip absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-semibold leading-tight">{person.name}</figcaption>
      </div>
      <span className="sr-only">{facts}</span>
    </figure>
  );
}

function Portrait({ face }: { face: Face }) {
  if (face.kind === "initials") return <span className="hud-display absolute inset-0 grid place-items-center text-3xl font-bold text-muted-foreground">{face.initials}</span>;
  const onColour: CSSProperties | undefined = face.kind === "company-profile" ? { backgroundColor: face.colour } : undefined;
  return <img src={face.image} alt="" loading="lazy" style={onColour} className={`absolute inset-0 size-full object-cover ${face.kind === "company-profile" ? "object-top" : ""}`} />;
}

function EmptySlot({ person, number }: { person: TeamPerson; number: number }) {
  return (
    <div className="bk-slot flex aspect-[3/4] flex-col items-center justify-center gap-1 p-2 text-center" title={`${person.name}: thank them, or be thanked by them, to collect this sticker`}>
      <span className="hud-display text-2xl font-bold tabular-nums text-muted-foreground/70 sm:text-3xl">{number}</span>
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">{person.name}</span>
      <span className="text-[10px] leading-tight text-muted-foreground/80">{person.role}</span>
    </div>
  );
}

function CompleteStamp({ at, timeZone }: { at: number; timeZone: string }) {
  return (
    <div className="bk-stamp bk-stamp-in pointer-events-none absolute bottom-10 right-5 flex flex-col items-center px-3 py-1 sm:right-8" aria-label="Album complete">
      <span className="hud-display flex items-center gap-1 text-lg font-bold uppercase tracking-wider">
        <IconCheck className="size-4" />
        Complete
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest">{dateWords(at, timeZone)}</span>
    </div>
  );
}

function PageNumber({ n, side }: { n: number; side: "left" | "right" }) {
  return <span className={`hud-display mt-auto hidden pt-2 text-xs tabular-nums text-muted-foreground lg:block ${side === "left" ? "self-start" : "self-end"}`}>{n}</span>;
}

export function TeamsAside({ children }: { children: ReactNode }) {
  return <span className="text-xs tabular-nums text-muted-foreground">{children}</span>;
}
