import { IconBook, IconChevronDown } from "@posthog/icons";
import type { ReactNode } from "react";
import { AppLink, useNavigate } from "../AppLink";
import type { BookPageId } from "../route";
import { bookHref, type Chapter } from "./categories";

export type CollectionChapterEntry = { id: string; label: string; href: string; count: string | null; current: boolean };

type IndexProps = { chapters: Chapter[]; current: BookPageId; collection: boolean; collectionChapters?: CollectionChapterEntry[] };

export function BookIndex({ chapters, current, collection, collectionChapters = [] }: IndexProps) {
  return (
    <nav aria-label="Book pages" className="sticky top-24">
      <div className="relative flex flex-col gap-1 rounded-lg border bg-card p-2">
        <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
          <IconBook className="size-4 text-muted-foreground" />
          <span className="text-base font-semibold">Book</span>
        </div>
        <IndexEntry page="overview" current={current}>
          Overview
        </IndexEntry>
        {collection && (
          <IndexEntry page="collection" current={current}>
            Collection
          </IndexEntry>
        )}
        {collectionChapters.length > 0 && (
          <ul className="mb-1 ml-4 flex flex-col gap-0.5 border-l pl-2">
            {collectionChapters.map((entry) => (
              <li key={entry.id}>
                <a href={entry.href} aria-current={entry.current ? "page" : undefined} className={`flex min-h-8 items-center justify-between gap-2 rounded-md px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${entry.current ? "bg-fill-selected font-medium text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}>
                  {entry.label}
                  {entry.count !== null && <span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-col gap-0.5">
          <span className="hud-label px-2 pb-1">Achievements</span>
          {chapters.map(({ category }) => (
            <IndexEntry key={category.id} page={category.id} current={current}>
              <span data-emblem="" aria-hidden="true" className="-my-1 shrink-0">
                <category.Emblem size={26} className={`book-index-hog ${category.id === current ? "" : "opacity-80"}`} />
              </span>
              {category.name}
            </IndexEntry>
          ))}
        </div>
      </div>
    </nav>
  );
}

function IndexEntry({ page, current, children }: { page: BookPageId; current: BookPageId; children: ReactNode }) {
  const here = page === current;
  return (
    <AppLink
      href={bookHref(page)}
      aria-current={here ? "page" : undefined}
      className={`relative flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${here ? "bg-fill-selected font-medium text-foreground before:absolute before:inset-y-1.5 before:-left-2 before:w-1 before:rounded-r-full before:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
    >
      {children}
    </AppLink>
  );
}

export function BookPagePicker({ chapters, current, collection }: IndexProps) {
  const navigate = useNavigate();
  return (
    <div className="relative mb-2 flex flex-col gap-1">
      <select aria-label="Book page" value={bookHref(current)} onChange={(event) => navigate(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-muted-foreground bg-card pl-3 pr-9 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <option value={bookHref("overview")}>Overview</option>
        {collection && <option value={bookHref("collection")}>Collection</option>}
        <optgroup label="Achievements">
          {chapters.map(({ category }) => (
            <option key={category.id} value={bookHref(category.id)}>
              {category.name}
            </option>
          ))}
        </optgroup>
      </select>
      <IconChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3 size-4 text-muted-foreground" />
    </div>
  );
}
