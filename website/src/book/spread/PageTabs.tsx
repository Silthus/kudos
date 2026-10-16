import { AppLink } from "../../AppLink";
import type { SpreadTab } from "./spreads";

export type TabCount = { shown: string; said: string };

export type Tab = { tab: SpreadTab; label: string; count: TabCount | null; href: string };

export function PageTabs({ tabs, current }: { tabs: Tab[]; current: SpreadTab }) {
  return (
    <nav aria-label="Book pages" className="-mb-px flex items-end gap-1 overflow-x-auto px-4 pt-1 sm:px-5">
      {tabs.map((tab) => (
        <AppLink key={tab.tab} href={tab.href} aria-current={tab.tab === current ? "page" : undefined} aria-label={tab.count === null ? undefined : `${tab.label}, ${tab.count.said}`} className="bk-page-tab shrink-0 gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {tab.label}
          {tab.count !== null && (
            <span aria-hidden="true" className="text-xs tabular-nums opacity-70">
              {tab.count.shown}
            </span>
          )}
        </AppLink>
      ))}
    </nav>
  );
}

export function countOf(value: number, max: number, said: string): TabCount {
  return { shown: `${value}/${max}`, said: `${value} of ${max} ${said}` };
}
