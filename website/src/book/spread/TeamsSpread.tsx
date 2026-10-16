import { useId, type ReactNode } from "react";
import { AppLink } from "../../AppLink";
import { TeamCrest } from "../../crates/TeamCrest";
import { MemberFace } from "../../Face";
import { QuietBar } from "../Bar";
import { NoStickersYet } from "../NoStickersYet";
import { PersonSilhouette } from "../PersonSilhouette";
import { StickerFace, stickerWordsOf } from "../StickerTile";
import { HoggieCoin } from "../HoggieCoin";
import { ChapterLabel, Page, PageHeading, row } from "./Page";
import { spreadHrefOf } from "./spreads";
import type { TeamPage, TeamPages, TeamSlot } from "./teamPages";

type TeamsProps = { teams: TeamPages; chatUrl: string; firstPage: number };

export function TeamsSpread({ teams, chatUrl, firstPage }: TeamsProps) {
  const mine = teams.pages.filter((page) => page.mine);
  const started = teams.pages.filter((page) => !page.mine && page.held > 0);
  const untouched = teams.pages.filter((page) => !page.mine && page.held === 0);
  return (
    <>
      <Page side="left" number={firstPage} label="Your teams and pages started">
        <ChapterLabel>Chapter 2 · Teams</ChapterLabel>
        {mine.length > 0 && (
          <Group title="Your teams">
            {mine.map((page) => (
              <li key={page.slug}>
                <TeamRow page={page} big />
              </li>
            ))}
          </Group>
        )}
        <Group title="Pages started" aside={`${started.length} with at least one sticker`}>
          {started.length === 0 ? <li className="px-2 text-sm text-muted-foreground">No page started yet. Open a crate, or thank a teammate, and its page begins.</li> : started.map((page) => <li key={page.slug}>{<TeamRow page={page} />}</li>)}
        </Group>
        {teams.stickers !== undefined && <Stickers stickers={teams.stickers} chatUrl={chatUrl} />}
      </Page>
      <Page side="right" number={firstPage + 1} label="Teams not started">
        <Group title={`Not started · ${untouched.length} ${untouched.length === 1 ? "team" : "teams"}`} columns>
          {untouched.map((page) => (
            <li key={page.slug} className="break-inside-avoid">
              <TeamRow page={page} small />
            </li>
          ))}
        </Group>
      </Page>
    </>
  );
}

function Group({ title, aside, columns = false, children }: { title: string; aside?: string; columns?: boolean; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <PageHeading id={headingId}>{title}</PageHeading>
        {aside !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{aside}</span>}
      </div>
      <ul className={columns ? "columns-2 gap-x-4" : "flex flex-col gap-1"}>{children}</ul>
    </section>
  );
}

function TeamRow({ page, big = false, small = false }: { page: TeamPage; big?: boolean; small?: boolean }) {
  return (
    <AppLink href={spreadHrefOf({ kind: "team", team: page.slug })} data-team={page.slug} className={`${row} ${big ? "bk-slot rounded-lg p-3" : small ? "px-1.5 py-1" : ""}`}>
      <TeamArt page={page} size={big ? 56 : small ? 26 : 36} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate ${big ? "hud-display text-lg font-bold" : small ? "text-xs" : "text-sm font-medium"}`}>{page.name}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{small ? page.total : `${page.held}/${page.total}`}</span>
        </span>
        {big && <QuietBar value={page.held} max={page.total} />}
        {big && <Faces slots={page.slots} />}
      </span>
    </AppLink>
  );
}

const faceSizes: Record<number, string> = { 56: "size-14", 36: "size-9", 26: "size-6" };

function TeamArt({ page, size }: { page: TeamPage; size: number }) {
  if (page.art !== null) {
    return (
      <span className="bk-crest-hover inline-flex">
        <TeamCrest art={page.art} size={size} collected={page.held > 0} />
      </span>
    );
  }
  const held = page.slots.find((slot) => slot.held);
  return held === undefined ? <PersonSilhouette className={faceSizes[size] ?? "size-9"} /> : <SlotFace slot={held} size={size} />;
}

function SlotFace({ slot, size }: { slot: TeamSlot; size: number }) {
  if (slot.picture.kind === "hoggie") return <HoggieCoin art={slot.picture.art} rarity={slot.picture.rarity} size={size} />;
  return <StickerFace sticker={{ face: slot.picture.face, former: slot.picture.former }} className={faceSizes[size] ?? "size-9"} />;
}

function Faces({ slots }: { slots: TeamSlot[] }) {
  return (
    <span aria-hidden="true" className="flex flex-wrap gap-1">
      {slots.map((slot) => (
        <span key={slot.key} className="bk-face inline-flex">
          {slot.held && slot.picture.kind === "face" ? <MemberFace face={slot.picture.face} className="size-6" /> : slot.held && slot.picture.kind === "hoggie" ? <HoggieCoin art={slot.picture.art} rarity={slot.picture.rarity} size={24} /> : <PersonSilhouette className="size-6" />}
        </span>
      ))}
    </span>
  );
}

function Stickers({ stickers, chatUrl }: { stickers: TeamPages["stickers"] & object; chatUrl: string }) {
  const headingId = useId();
  const shown = stickers.slice(0, 12);
  return (
    <section aria-labelledby={headingId} className="mt-auto flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <PageHeading id={headingId}>Stickers</PageHeading>
        <span className="text-xs tabular-nums text-muted-foreground">{stickerWordsOf(stickers)}</span>
      </div>
      {stickers.length === 0 ? (
        <NoStickersYet chatUrl={chatUrl} />
      ) : (
        <ul aria-hidden="true" className="flex flex-wrap items-center gap-1">
          {shown.map((sticker) => (
            <li key={sticker.key} className="bk-face inline-flex">
              <StickerFace sticker={sticker} className="size-8" />
            </li>
          ))}
          {stickers.length > shown.length && <li className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">{`+${stickers.length - shown.length}`}</li>}
        </ul>
      )}
    </section>
  );
}
