import { IconBook, IconChevronDown } from "@posthog/icons";
import type { ReactNode } from "react";
import { AppLink, useNavigate } from "../AppLink";
import type { BookPageId } from "../route";
import { bookHref, type Chapter } from "./categories";

type IndexProps = { chapters: Chapter[]; current: BookPageId };

export function BookIndex({ chapters, current }: IndexProps) {
  return (
    <nav aria-label="Book pages" className="sticky top-24">
      <div className="relative flex flex-col gap-1 rounded-xl border bg-card p-2">
        <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
          <IconBook className="size-4 text-muted-foreground" />
          <span className="hud-display text-lg font-bold">Book</span>
        </div>
        <IndexEntry page="overview" current={current}>
          Overview
        </IndexEntry>
        <div className="mt-2 flex flex-col gap-0.5">
          <span className="hud-label px-2 pb-1">Achievements</span>
          {chapters.map(({ category }) => (
            <IndexEntry key={category.id} page={category.id} current={current}>
              <span data-emblem="" aria-hidden="true" className="-my-1 shrink-0">
                <category.Emblem size={26} title="" className={`book-index-hog ${category.id === current ? "" : "opacity-80"}`} />
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
      className={`relative flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${here ? "bg-fill-selected font-medium text-foreground before:absolute before:inset-y-1.5 before:-left-2 before:w-1 before:rounded-r-full before:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
    >
      {children}
    </AppLink>
  );
}

export function BookPagePicker({ chapters, current }: IndexProps) {
  const navigate = useNavigate();
  return (
    <label className="relative flex flex-col gap-1">
      <span className="hud-label flex items-center gap-1.5">
        <IconBook className="size-3.5" /> Book page
      </span>
      <select value={bookHref(current)} onChange={(event) => navigate(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-muted-foreground bg-card pl-3 pr-9 text-sm font-medium text-foreground">
        <option value={bookHref("overview")}>Overview</option>
        <optgroup label="Achievements">
          {chapters.map(({ category }) => (
            <option key={category.id} value={bookHref(category.id)}>
              {category.name}
            </option>
          ))}
        </optgroup>
      </select>
      <IconChevronDown aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3 size-4 text-muted-foreground" />
    </label>
  );
}
