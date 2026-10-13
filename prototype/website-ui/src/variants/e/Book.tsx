// Variant E book: sticker albums and achievements as one album, with a hedgehog page index on the left whose only primary is the current page marker, and Panini spreads or achievement pages on the right.
import { useEffect, useRef, useState } from "react";
import { IconBook, IconCheck, IconChevronDown } from "@posthog/icons";
import { me } from "../../data/mock";
import { useHashRoute } from "../../nav";
import { AlbumSpread, crestOf, type TeamPhoto } from "./book-album";
import { CategoryPage, Overview } from "./book-achievements";
import { albumsMineFirst, bookLadders, categories, laddersIn, pageFor, pageHref, pageKey, tierCount, type BookPage } from "./book-data";
import { artOfCategory, BookArt, type Art } from "./book-emblems";
import { useHud } from "./hud";
import "./book.css";

type Entry = { page: BookPage; label: string; art: Art; value: number; max: number; done: boolean; note?: string };

const overviewEntry: Entry = { page: { kind: "overview" }, label: "Overview", art: BookArt, ...countOf(tierCount(bookLadders)), done: false };

const albumEntries: Entry[] = albumsMineFirst.map((album) => ({ page: { kind: "album", album }, label: album.group.name, art: crestOf(album.group.id), value: album.held, max: album.pages, done: album.complete, note: album.mine ? "Yours" : undefined }));

const categoryEntries: Entry[] = categories.map((category) => {
  const count = tierCount(laddersIn(category));
  return { page: { kind: "category", category }, label: category.name, art: artOfCategory(category.id), ...countOf(count), done: count.earned === count.total };
});

function countOf({ earned, total }: { earned: number; total: number }) {
  return { value: earned, max: total };
}

export function Book({ param }: { param?: string }) {
  useHud();
  const route = useHashRoute();
  const page = pageFor(route.screen, param);
  const [photos, setPhotos] = useTeamPhotos();
  const key = pageKey(page);

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <PageIndex current={key} />
      <MobileIndex current={page} />
      <div key={key} className="hud-rise min-w-0">
        {page.kind === "album" && <AlbumSpread album={page.album} photo={photos[page.album.group.id]} onPhoto={(photo) => setPhotos(page.album.group.id, photo)} />}
        {page.kind === "category" && <CategoryPage category={page.category} />}
        {page.kind === "overview" && <Overview />}
      </div>
    </div>
  );
}

function useTeamPhotos() {
  const [photos, setPhotos] = useState<Record<string, TeamPhoto | undefined>>({ [me.primaryGroup.id]: { kind: "posthog" } });
  const latest = useRef(photos);
  latest.current = photos;
  useEffect(() => () => Object.values(latest.current).forEach(revoke), []);
  const set = (groupId: string, photo: TeamPhoto | undefined) =>
    setPhotos((all) => {
      revoke(all[groupId]);
      return { ...all, [groupId]: photo };
    });
  return [photos, set] as const;
}

function revoke(photo: TeamPhoto | undefined) {
  if (photo?.kind === "upload") URL.revokeObjectURL(photo.url);
}

function PageIndex({ current }: { current: string }) {
  return (
    <nav aria-label="Book pages" className="hidden lg:sticky lg:top-24 lg:block">
      <div className="hud-panel relative flex flex-col gap-1 rounded-xl border bg-card p-2">
        <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
          <IconBook className="size-4 text-muted-foreground" />
          <span className="hud-display text-lg font-bold">Book</span>
        </div>
        <IndexLink entry={overviewEntry} current={current} />
        <IndexGroup label="Sticker albums" entries={albumEntries} current={current} />
        <IndexGroup label="Achievements" entries={categoryEntries} current={current} />
      </div>
    </nav>
  );
}

function IndexGroup({ label, entries, current }: { label: string; entries: Entry[]; current: string }) {
  return (
    <div className="mt-2 flex flex-col gap-0.5">
      <span className="hud-label px-2 pb-1">{label}</span>
      {entries.map((entry) => (
        <IndexLink key={pageKey(entry.page)} entry={entry} current={current} />
      ))}
    </div>
  );
}

function IndexLink({ entry, current }: { entry: Entry; current: string }) {
  const active = pageKey(entry.page) === current;
  const percent = entry.max > 0 ? (entry.value / entry.max) * 100 : 0;
  return (
    <a
      href={pageHref(entry.page)}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors ${active ? "bg-fill-selected text-foreground before:absolute before:inset-y-1.5 before:-left-2 before:w-1 before:rounded-r-full before:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
    >
      <span className="flex items-center gap-2 text-sm">
        <entry.art size={26} className={`bk-index-hog -my-1 shrink-0 ${active ? "" : "opacity-80"}`} title="" />
        <span className={`min-w-0 flex-1 truncate ${active ? "font-medium" : ""}`}>{entry.label}</span>
        {entry.note && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{entry.note}</span>}
        {entry.done ? <IconCheck className="size-3.5 text-foreground" aria-label="Complete" /> : null}
        <span className="text-xs tabular-nums text-muted-foreground">
          {entry.value}/{entry.max}
        </span>
      </span>
      <span className="ml-[34px] h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={`block h-full rounded-full ${entry.done ? "bg-foreground/70" : "bk-bar-fill"}`} style={{ width: `${percent}%` }} />
      </span>
    </a>
  );
}

function MobileIndex({ current }: { current: BookPage }) {
  const option = (entry: Entry) => (
    <option key={pageKey(entry.page)} value={pageHref(entry.page)}>
      {entry.label} · {entry.value}/{entry.max}
      {entry.done ? " ✓" : ""}
    </option>
  );
  return (
    <label className="relative flex flex-col gap-1 lg:hidden">
      <span className="hud-label flex items-center gap-1.5">
        <IconBook className="size-3.5" /> Book page
      </span>
      <select value={pageHref(current)} onChange={(event) => (location.hash = event.target.value)} className="h-11 w-full appearance-none rounded-lg border bg-card pl-3 pr-9 text-sm font-medium text-foreground">
        {option(overviewEntry)}
        <optgroup label="Sticker albums">{albumEntries.map(option)}</optgroup>
        <optgroup label="Achievements">{categoryEntries.map(option)}</optgroup>
      </select>
      <IconChevronDown className="pointer-events-none absolute bottom-3.5 right-3 size-4 text-muted-foreground" />
    </label>
  );
}
