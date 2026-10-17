// PROTOTYPE (#625): the collection book: fixed-size spread with tabs, chapters on the left and paginated pages on the right. Never merge to main.
import { IconChevronLeft, IconChevronRight } from "@posthog/icons";
import { useEffect, useState, type ReactNode } from "react";
import { HedgehogReadingIsMagic } from "../../hoggies";
import { prefersReducedMotion } from "../../reducedMotion";
import { CrestArt } from "../art";
import { rarityColour, rarityOrder, type World } from "../world";
import { bookAddressHere, hrefOfChapter, useRelocate, type BookAddress, type Chapter } from "./address";
import { HoggieSlots, LadderSlots, PackSlots, RarityTitle, StickerSlots, TeamHeader } from "./BookLeaves";
import { Coin } from "./motion";
import { StoreCounter } from "./Store";
import { rarityName } from "./words";

type Tab = Chapter["kind"];

type Turn = "forward" | "back";

const tabs: { tab: Tab; label: string }[] = [
  { tab: "hoggies", label: "Hoggies" },
  { tab: "teams", label: "Teams" },
  { tab: "store", label: "Store" },
  { tab: "earned", label: "Achievements" },
];

const perPage: Record<Tab, number> = { hoggies: 15, teams: 12, store: 8, earned: 4 };

type Leaf = { title: ReactNode; body: ReactNode; pages: number };

export function Book({ world }: { world: World }) {
  const firstTeam = world.teams[0]?.team ?? "";
  const address = bookAddressHere(firstTeam);
  const { chapter } = address;
  const relocate = useRelocate();
  const [turn, setTurn] = useState<Turn>("forward");
  const leaf = leafOf(world, address);
  const page = Math.min(address.page, leaf.pages);

  const goTo = (next: Chapter, nextPage: number, how: "push" | "replace", direction: Turn) => {
    setTurn(direction);
    relocate(hrefOfChapter(next, nextPage), how);
  };
  const flip = (by: number) => {
    const target = page + by;
    if (target < 1 || target > leaf.pages) return;
    goTo(chapter, target, "replace", by > 0 ? "forward" : "back");
  };
  useArrowKeys(flip);

  return (
    <div className="v3-page v3-book-page">
      <header className="v3-page-head">
        <div>
          <p className="v3-eyebrow">Your book</p>
          <h1 className="v3-h1" tabIndex={-1}>
            Collection
          </h1>
        </div>
        <p className="v3-muted v3-num">{`${world.owned} of ${world.total} hoggies · ${world.teams.filter(({ complete }) => complete).length} of ${world.teams.length} team pages complete`}</p>
      </header>
      <div className="v3-book">
        <div className="v3-book-tabs" role="tablist" aria-label="Book chapters">
          {tabs.map(({ tab, label }) => (
            <button key={tab} type="button" role="tab" aria-selected={chapter.kind === tab} className="v3-book-tab" onClick={() => goTo(firstChapterOf(tab, firstTeam), 1, "push", "forward")}>
              {label}
            </button>
          ))}
        </div>
        <div className="v3-spread">
          <div className="v3-leaf v3-leaf-left">
            <ChapterIndex world={world} chapter={chapter} onPick={(next) => goTo(next, 1, "push", "forward")} />
          </div>
          <div className="v3-spine" aria-hidden="true" />
          <div className="v3-leaf v3-leaf-right" key={`${hrefOfChapter(chapter)}:${page}`} data-turn={turn}>
            {leaf.title}
            <div className="v3-leaf-body">{leaf.body}</div>
            <Pager page={page} pages={leaf.pages} onFlip={flip} />
          </div>
          <Cover />
        </div>
      </div>
    </div>
  );
}

function firstChapterOf(tab: Tab, firstTeam: string): Chapter {
  if (tab === "hoggies") return { kind: "hoggies", rarity: "common" };
  if (tab === "teams") return { kind: "teams", team: firstTeam };
  return { kind: tab };
}

function pageOf<T>(items: T[], size: number, page: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const shown = Math.min(page, pages);
  return { items: items.slice((shown - 1) * size, shown * size), pages };
}

function leafOf(world: World, { chapter, page }: BookAddress): Leaf {
  if (chapter.kind === "hoggies") {
    const all = world.hoggies.filter(({ rarity }) => rarity === chapter.rarity);
    const { items, pages } = pageOf(all, perPage.hoggies, page);
    const owned = all.filter(({ count }) => count > 0).length;
    return { title: <RarityTitle rarity={chapter.rarity} owned={owned} total={all.length} />, body: <HoggieSlots hoggies={items} />, pages };
  }
  if (chapter.kind === "teams") {
    const team = world.teams.find((entry) => entry.team === chapter.team) ?? world.teams[0];
    if (team === undefined) return { title: null, body: <p className="v3-empty">No team pages yet.</p>, pages: 1 };
    const { items, pages } = pageOf(team.people, perPage.teams, page);
    return { title: <TeamHeader team={team} />, body: <StickerSlots people={items} />, pages };
  }
  if (chapter.kind === "store") {
    const { items, pages } = pageOf(world.packs, perPage.store, page);
    return { title: <LeafTitle title="Packs waiting" note={`${world.packs.length} to open`} />, body: <PackSlots packs={items} />, pages };
  }
  const { items, pages } = pageOf(world.achievements, perPage.earned, page);
  return { title: <LeafTitle title="Achievements" note="Tiers you earn by thanking and being thanked" />, body: <LadderSlots ladders={items} />, pages };
}

function LeafTitle({ title, note }: { title: string; note: string }) {
  return (
    <header className="v3-leaf-title">
      <h2 className="v3-h2">{title}</h2>
      <span className="v3-muted">{note}</span>
    </header>
  );
}

function ChapterIndex({ world, chapter, onPick }: { world: World; chapter: Chapter; onPick: (chapter: Chapter) => void }) {
  if (chapter.kind === "hoggies")
    return (
      <IndexList title="Hoggies" note={`${world.owned} of ${world.total} found`} art={<HedgehogReadingIsMagic size={150} className="v3-index-art" />}>
        {rarityOrder.map((rarity) => {
          const share = world.rarities.find((entry) => entry.rarity === rarity)!;
          return (
            <IndexEntry key={rarity} current={chapter.rarity === rarity} onPick={() => onPick({ kind: "hoggies", rarity })} count={`${share.owned}/${share.total}`} share={share.owned / share.total} colour={rarityColour[rarity]}>
              <span className="v3-rarity-dot" style={{ background: rarityColour[rarity] }} />
              {rarityName[rarity]}
            </IndexEntry>
          );
        })}
      </IndexList>
    );
  if (chapter.kind === "teams")
    return (
      <IndexList title="Team pages" note="A sticker for every teammate you thank">
        {world.teams.map((team) => (
          <IndexEntry key={team.team} current={chapter.team === team.team} onPick={() => onPick({ kind: "teams", team: team.team })} count={`${team.held}/${team.total}`} share={team.total === 0 ? 0 : team.held / team.total}>
            <CrestArt art={team.art} size={24} name={team.name} collected={team.crest !== null || team.complete} />
            {team.name}
          </IndexEntry>
        ))}
      </IndexList>
    );
  if (chapter.kind === "store") return <StoreLeaf world={world} />;
  return <EarnedLeaf world={world} />;
}

function IndexList({ title, note, art, children }: { title: string; note: string; art?: ReactNode; children: ReactNode }) {
  return (
    <nav aria-label={title} className="v3-index">
      <header className="v3-leaf-title">
        <h2 className="v3-h2">{title}</h2>
        <span className="v3-muted">{note}</span>
      </header>
      <ul className="v3-index-list">{children}</ul>
      {art}
    </nav>
  );
}

function IndexEntry({ current, onPick, count, share, colour, children }: { current: boolean; onPick: () => void; count: string; share: number; colour?: string; children: ReactNode }) {
  return (
    <li>
      <button type="button" className="v3-index-entry" aria-current={current || undefined} onClick={onPick}>
        <span className="v3-index-name">{children}</span>
        <span className="v3-num v3-muted">{count}</span>
        <span className="v3-mini-bar v3-index-bar" aria-hidden="true">
          <span style={{ width: `${share * 100}%`, background: colour }} />
        </span>
      </button>
    </li>
  );
}

function StoreLeaf({ world }: { world: World }) {
  return (
    <div className="v3-index">
      <header className="v3-leaf-title">
        <h2 className="v3-h2">Store</h2>
        <span className="v3-muted">Spend coins you earn from quests and packs</span>
      </header>
      <p className="v3-wallet">
        <Coin size={28} />
        <strong className="v3-num">{world.coins}</strong>
        <span className="v3-muted">coins</span>
      </p>
      <StoreCounter world={world} />
      <p className="v3-muted v3-small">Every pack holds one hoggie. Copies still pay XP and coins.</p>
    </div>
  );
}

function EarnedLeaf({ world }: { world: World }) {
  const tiers = world.achievements.flatMap(({ tiers }) => tiers);
  const earned = tiers.filter(({ earnedAt }) => earnedAt !== null);
  const byMetal = (["bronze", "silver", "gold", "diamond"] as const).map((metal) => ({ metal, count: earned.filter(({ tier }) => tier === metal).length }));
  return (
    <div className="v3-index">
      <header className="v3-leaf-title">
        <h2 className="v3-h2">Medals</h2>
        <span className="v3-muted">{`${earned.length} of ${tiers.length} tiers earned`}</span>
      </header>
      <ul className="v3-metals">
        {byMetal.map(({ metal, count }) => (
          <li key={metal} data-metal={metal}>
            <span className="v3-metal-disc" />
            <span className="v3-metal-name">{metal}</span>
            <strong className="v3-num">{count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pager({ page, pages, onFlip }: { page: number; pages: number; onFlip: (by: number) => void }) {
  return (
    <footer className="v3-pager">
      <button type="button" className="v3-pager-button" onClick={() => onFlip(-1)} disabled={page <= 1} aria-label="Previous page">
        <IconChevronLeft className="v3-link-icon" />
      </button>
      <span className="v3-num v3-muted">{`Page ${page} of ${pages}`}</span>
      <button type="button" className="v3-pager-button" onClick={() => onFlip(1)} disabled={page >= pages} aria-label="Next page">
        <IconChevronRight className="v3-link-icon" />
      </button>
      <span className="v3-pager-hint v3-muted v3-small">← → to turn</span>
    </footer>
  );
}

function Cover() {
  const [open, setOpen] = useState(prefersReducedMotion);
  if (open) return null;
  return (
    <div className="v3-cover" aria-hidden="true" onAnimationEnd={() => setOpen(true)}>
      <span className="v3-cover-title">HedgeHug</span>
      <span className="v3-cover-sub">Collection</span>
    </div>
  );
}

function useArrowKeys(flip: (by: number) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [role='dialog']")) return;
      if (event.key === "ArrowRight") flip(1);
      if (event.key === "ArrowLeft") flip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
