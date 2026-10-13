// Variant E book album: a Panini-style spread with the team crest, a framed team photo and numbered die-cut stickers with ink name strips; the upload action is the page's one primary.
import type { ChangeEvent, ComponentType } from "react";
import {
  HedgehogBasketballCoach,
  HedgehogClimber,
  HedgehogCoffeeCup,
  HedgehogConstruction,
  HedgehogFootballPlayer,
  HedgehogGardener,
  HedgehogParty,
  HedgehogSafari,
  HedgehogSelfie,
  HedgehogSitting,
  HedgehogSoccerCoach,
} from "@posthog/brand/hoggies";
import { IconCheck, IconImage, IconLock, IconUpload } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { ladders, me } from "../../data/mock";
import type { Album } from "../../data/types";
import { avatarUrl } from "./avatars";
import { albumsMineFirst, earnedDate, formatDate, rosterOf, stickerTilt, type Slot } from "./book-data";

export type TeamPhoto = { kind: "upload"; url: string } | { kind: "posthog" };

type Art = ComponentType<{ size?: number; className?: string; title?: string }>;

const crests: Record<string, Art> = { g1: HedgehogGardener, g2: HedgehogConstruction, g3: HedgehogCoffeeCup, g4: HedgehogClimber, g5: HedgehogSafari };

export const crestOf = (groupId: string): Art => crests[groupId] ?? HedgehogSitting;

const teamSpirit = ladders.find((l) => l.id === "team-spirit");
const completedOn = teamSpirit && earnedDate(teamSpirit, 0);

export function AlbumSpread({ album, photo, onPhoto }: { album: Album; photo?: TeamPhoto; onPhoto: (photo: TeamPhoto | undefined) => void }) {
  const slots = rosterOf(album);
  const spreadNumber = albumsMineFirst.indexOf(album) * 2 + 2;
  return (
    <article className="bk-book grid overflow-hidden lg:grid-cols-2" aria-label={`${album.group.name} album`}>
      <section className="bk-paper bk-page-left flex flex-col gap-5 p-5 sm:p-7">
        <TeamHeader album={album} />
        <TeamPhotoFrame album={album} photo={photo} onPhoto={onPhoto} />
        <AlbumNotes album={album} className="mt-auto hidden lg:flex" />
        <PageNumber n={spreadNumber} side="left" />
      </section>
      <section className="bk-paper bk-page-right relative flex flex-col gap-4 p-5 pt-2 sm:p-7 lg:pt-7">
        <div className="flex items-baseline justify-between gap-3">
          <span className="hud-label">Stickers {slots[0]?.number}–{slots.at(-1)?.number}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {album.held} of {album.pages} stuck in
          </span>
        </div>
        <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-3">
          {slots.map((slot) => (
            <li key={slot.member.id}>{slot.held ? <StickerCard slot={slot} groupId={album.group.id} /> : <EmptySlot slot={slot} />}</li>
          ))}
        </ol>
        <AlbumNotes album={album} className="mt-2 flex lg:hidden" />
        {album.complete && <CompleteStamp />}
        <PageNumber n={spreadNumber + 1} side="right" />
      </section>
    </article>
  );
}

function TeamHeader({ album }: { album: Album }) {
  const Crest = crestOf(album.group.id);
  const primary = album.group.id === me.primaryGroup.id;
  return (
    <header className="flex items-center gap-4">
      <span className="bk-crest relative grid size-16 shrink-0 place-items-center bg-foreground/10 sm:size-20">
        <span className="bk-crest absolute inset-1 bg-card/70" aria-hidden />
        <Crest size={56} className="relative" title={`${album.group.name} crest`} />
      </span>
      <div className="min-w-0">
        <span className="hud-label">{primary ? "Primary group" : album.mine ? "Your group" : "Group"}</span>
        <h2 className="hud-display truncate text-3xl font-bold leading-tight sm:text-4xl">{album.group.name}</h2>
        <span className="text-xs text-muted-foreground">{album.group.members} members</span>
      </div>
    </header>
  );
}

function TeamPhotoFrame({ album, photo, onPhoto }: { album: Album; photo?: TeamPhoto; onPhoto: (photo: TeamPhoto | undefined) => void }) {
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onPhoto({ kind: "upload", url: URL.createObjectURL(file) });
    event.target.value = "";
  };
  return (
    <figure className="flex flex-col gap-2">
      <div className={`relative aspect-[16/10] ${photo ? "bk-print p-2" : ""}`}>
        {photo ? <FilledPhoto album={album} photo={photo} /> : <EmptyPhoto album={album} upload={upload} onPosthog={() => onPhoto({ kind: "posthog" })} />}
        {photo && (
          <>
            <span className="bk-corner bk-corner-tl" aria-hidden />
            <span className="bk-corner bk-corner-tr" aria-hidden />
            <span className="bk-corner bk-corner-bl" aria-hidden />
            <span className="bk-corner bk-corner-br" aria-hidden />
          </>
        )}
      </div>
      {photo && (
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{photo.kind === "posthog" ? "Team photo from posthog.com" : "Team photo uploaded by you"}</span>
          {album.mine && (
            <span className="flex items-center gap-1">
              <UploadButton label="Change" onChange={upload} quiet />
              <Button variant="link-muted" size="xs" onClick={() => onPhoto(undefined)}>
                Remove
              </Button>
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function FilledPhoto({ album, photo }: { album: Album; photo: TeamPhoto }) {
  if (photo.kind === "upload") return <img src={photo.url} alt={`${album.group.name} team photo`} className="size-full object-cover" />;
  return <PosthogTeamPhoto name={album.group.name} />;
}

function PosthogTeamPhoto({ name }: { name: string }) {
  const back: Art[] = [HedgehogSoccerCoach, HedgehogBasketballCoach, HedgehogParty];
  const front: Art[] = [HedgehogFootballPlayer, HedgehogSitting];
  return (
    <div role="img" aria-label={`${name} team photo, an illustration from posthog.com`} className="bk-photo-sky relative size-full overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-[34%] bk-photo-ground" aria-hidden />
      <div className="absolute inset-x-0 bottom-[24%] flex items-end justify-center gap-[3%]">
        {back.map((Hog, i) => (
          <Hog key={i} size={76} className="h-auto w-[21%]" title="" />
        ))}
      </div>
      <div className="absolute inset-x-0 -bottom-[3%] flex items-end justify-center gap-[24%]">
        {front.map((Hog, i) => (
          <Hog key={i} size={88} className="h-auto w-[25%]" title="" />
        ))}
      </div>
      <span className="hud-display absolute left-2 top-1.5 text-[10px] font-bold uppercase tracking-widest text-black/45">{name}</span>
    </div>
  );
}

function EmptyPhoto({ album, upload, onPosthog }: { album: Album; upload: (event: ChangeEvent<HTMLInputElement>) => void; onPosthog: () => void }) {
  return (
    <div className="bk-slot flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
      <HedgehogSelfie size={64} className="opacity-60" title="" />
      <p className="text-sm font-medium">No team photo yet</p>
      {album.mine ? (
        <div className="flex flex-wrap justify-center gap-2">
          <UploadButton label="Upload a team photo" onChange={upload} />
          <Button variant="outline" size="sm" onClick={onPosthog}>
            <IconImage />
            Use our photo from posthog.com
          </Button>
        </div>
      ) : (
        <p className="max-w-xs text-xs text-muted-foreground">Members of {album.group.name} can add one.</p>
      )}
    </div>
  );
}

function UploadButton({ label, onChange, quiet = false }: { label: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; quiet?: boolean }) {
  const look = quiet ? "h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground" : "h-8 gap-1.5 bg-primary px-3 text-sm text-primary-foreground hover:opacity-90";
  return (
    <label className={`inline-flex cursor-pointer items-center rounded-md font-medium focus-within:ring-2 focus-within:ring-ring ${look}`}>
      {!quiet && <IconUpload className="size-4" />}
      {label}
      <input type="file" accept="image/*" className="sr-only" onChange={onChange} />
    </label>
  );
}

function AlbumNotes({ album, className }: { album: Album; className: string }) {
  const percent = Math.round((album.held / album.pages) * 100);
  return (
    <div className={`flex-col gap-3 ${className}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{album.complete ? "Every page filled" : `${album.pages - album.held} still to collect`}</span>
          <span className="tabular-nums text-muted-foreground">
            {album.held}/{album.pages}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border" role="img" aria-label={`${percent}% collected`}>
          <div className={`hud-fill h-full rounded-full ${album.complete ? "bg-foreground" : "bk-bar-fill"}`} style={{ width: `${percent}%` }} />
        </div>
        {!album.complete && album.missing.length > 0 && <p className="text-xs text-muted-foreground">Still to swap thanks with {album.missing.map((m) => m.name).join(", ")}.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Every group has one. Its pages are the group's members, apart from you, and a completed album stays complete. Completed albums count toward the{" "}
        <a href="#/achievements/connections" className="text-foreground underline underline-offset-2">
          Team Spirit
        </a>{" "}
        achievement.
      </p>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <IconLock className="mt-px size-3.5 shrink-0" />
        <span>Your stickers are yours to keep, forever. Only you can see them. Team photos are shared with the group.</span>
      </p>
    </div>
  );
}

function StickerCard({ slot, groupId }: { slot: Slot; groupId: string }) {
  const facts = slot.sticker ? [`Since ${slot.sticker.since}`, slot.sticker.thanked && "you thanked them", slot.sticker.thankedMe && "they thanked you"].filter(Boolean).join(" · ") : "Collected";
  return (
    <figure className="bk-sticker flex aspect-[3/4] flex-col" style={{ transform: `rotate(${stickerTilt(slot.member.id, groupId)}deg)` }} title={`${slot.member.name}. ${facts}`}>
      <div className="bk-sheen relative flex-1 overflow-hidden rounded-[6px] bg-muted">
        <img src={avatarUrl(slot.member.name)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        <span className="hud-display absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-card px-1 text-[11px] font-bold tabular-nums text-foreground shadow-sm">{slot.number}</span>
        <figcaption className="bk-name-strip absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-semibold leading-tight">{slot.member.name}</figcaption>
      </div>
      <span className="sr-only">{facts}</span>
    </figure>
  );
}

function EmptySlot({ slot }: { slot: Slot }) {
  return (
    <div className="bk-slot flex aspect-[3/4] flex-col items-center justify-center gap-1 p-2 text-center" title={`${slot.member.name}: thank them, or be thanked by them, to collect this sticker`}>
      <span className="hud-display text-2xl font-bold tabular-nums text-muted-foreground/70 sm:text-3xl">{slot.number}</span>
      <span className="text-[11px] font-medium leading-tight text-muted-foreground">{slot.member.name}</span>
    </div>
  );
}

function CompleteStamp() {
  return (
    <div className="bk-stamp bk-stamp-in pointer-events-none absolute bottom-10 right-5 flex flex-col items-center px-3 py-1 sm:right-8" aria-label="Album complete">
      <span className="hud-display flex items-center gap-1 text-lg font-bold uppercase tracking-wider">
        <IconCheck className="size-4" />
        Complete
      </span>
      {completedOn && <span className="text-[10px] font-semibold uppercase tracking-widest">{formatDate(completedOn)}</span>}
    </div>
  );
}

function PageNumber({ n, side }: { n: number; side: "left" | "right" }) {
  return <span className={`hud-display mt-auto hidden pt-2 text-xs tabular-nums text-muted-foreground lg:block ${side === "left" ? "self-start" : "self-end"}`}>{n}</span>;
}
