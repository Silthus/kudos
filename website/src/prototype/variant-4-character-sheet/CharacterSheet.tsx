// PROTOTYPE (#625): variant 4, a light ARPG character sheet: paperdoll, inventory grid, quest log and the Tome of Hoggies. Never merge to main.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppLink, useNavigate } from "../../AppLink";
import type { Route } from "../../route";
import type { VariantProps } from "../PrototypeStage";
import { useWorld, type Quest, type World } from "../world";
import { Inventory, type BagMarks, type BagTab } from "./Inventory";
import { LevelUp, LootBurst, QuestComplete } from "./Moments";
import { AchievementsPanel, ActivityPanel, LeaderboardPanel, SettingsPanel, StorePanel } from "./Panels";
import { Paperdoll } from "./Paperdoll";
import { QuestLog } from "./QuestLog";
import { Shelf } from "./Shelf";
import { Tome } from "./Tome";
import { TipProvider, useTipControls } from "./Tooltip";
import "./characterSheet.css";

type Side = "inventory" | "quests" | "store" | "achievements" | "activity" | "leaderboard" | "settings";

const panelButtons: { side: Side | "tome"; label: string; key: string; href: string }[] = [
  { side: "inventory", label: "Inventory", key: "I", href: "/" },
  { side: "quests", label: "Quests", key: "Q", href: "/quests" },
  { side: "tome", label: "Tome", key: "B", href: "/book" },
  { side: "store", label: "Store", key: "V", href: "/book#store" },
  { side: "achievements", label: "Achievements", key: "A", href: "/book/earned" },
  { side: "activity", label: "Activity", key: "C", href: "/activity" },
  { side: "leaderboard", label: "Leaderboard", key: "L", href: "/leaderboard" },
  { side: "settings", label: "Settings", key: "O", href: "/settings" },
];

function sideOf(route: Route): Side {
  if (route.page === "quests") return "quests";
  if (route.page === "activity") return "activity";
  if (route.page === "leaderboard") return "leaderboard";
  if (route.page === "settings") return "settings";
  if (route.page === "book" && route.bookPage === "earned") return "achievements";
  if (route.page === "book" && window.location.hash === "#store") return "store";
  return "inventory";
}

function tomeIsOpen(route: Route) {
  return route.page === "book" && route.bookPage !== "earned" && window.location.hash !== "#store";
}

export function CharacterSheet(props: VariantProps) {
  return (
    <div className="v4-root">
      <TipProvider>
        <Sheet {...props} />
      </TipProvider>
    </div>
  );
}

function Sheet({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const navigate = useNavigate();
  const tips = useTipControls();
  const latest = useRef(actions);
  latest.current = actions;
  const [tab, setTab] = useState<BagTab>("bag");
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [newSlugs, setNewSlugs] = useState<ReadonlySet<string>>(new Set());
  const [glint, setGlint] = useState<string | null>(null);
  const [settledPacks, setSettledPacks] = useState<ReadonlySet<string>>(() => new Set(world.packs.map(({ id }) => id)));
  const celebrating = useQuestCompletion(world.quests, () => setTab("bag"));
  const side = sideOf(route);
  const tomeOpen = tomeIsOpen(route);

  const openPack = useCallback(
    (id: string) => {
      tips.clear();
      const drop = latest.current.openPack(id);
      if (drop === null) return;
      if (drop.isNew) setNewSlugs((slugs) => new Set(slugs).add(drop.hoggie));
      setGlint(drop.hoggie);
      setTab("bag");
      if (drop.levelAfter > drop.levelBefore) setLevelUp(drop.levelAfter);
    },
    [tips],
  );

  const revealing = world.lastDrop !== null;
  useEffect(() => {
    if (levelUp === null || revealing) return;
    const timer = window.setTimeout(() => setLevelUp(null), 3400);
    return () => window.clearTimeout(timer);
  }, [levelUp, revealing]);

  useHotkeys(tomeOpen || world.lastDrop !== null, navigate);

  const marks: BagMarks = { newSlugs, glint, settledPacks, onPackSettled: (id) => setSettledPacks((ids) => new Set(ids).add(id)) };

  return (
    <div className="v4-sheet" data-side={side}>
      <TopBar side={tomeOpen ? "tome" : side} world={world} />
      <main className="v4-main">
        <Paperdoll world={world} onOpenPack={openPack} />
        {side === "quests" ? null : <div className="v4-centre">{centreOf(side, { world, actions, tab, setTab, openPack, marks, todaysPage })}</div>}
        <QuestLog quests={world.quests} packs={world.packs} expanded={side === "quests"} onProgress={actions.progressQuest} onFinish={actions.finishQuest} onOpenPack={openPack} />
      </main>
      {tomeOpen && <Tome world={world} />}
      {world.lastDrop !== null && <LootBurst drop={world.lastDrop} onTake={actions.forgetLastDrop} />}
      {levelUp !== null && world.lastDrop === null && <LevelUp level={levelUp} />}
      {celebrating !== null && <QuestComplete key={celebrating.id} quest={celebrating} />}
    </div>
  );
}

type CentreWiring = { world: World; actions: ReturnType<typeof useWorld>["actions"]; tab: BagTab; setTab: (tab: BagTab) => void; openPack: (id: string) => void; marks: BagMarks; todaysPage: ReactNode };

function centreOf(side: Side, { world, actions, tab, setTab, openPack, marks, todaysPage }: CentreWiring) {
  if (side === "store") return <StorePanel world={world} actions={actions} onOpenPack={openPack} />;
  if (side === "achievements") return <AchievementsPanel world={world} />;
  if (side === "activity") return <ActivityPanel world={world} />;
  if (side === "leaderboard") return <LeaderboardPanel world={world} />;
  if (side === "settings") return <SettingsPanel todaysPage={todaysPage} />;
  return (
    <>
      <Inventory world={world} tab={tab} onTab={setTab} onOpenPack={openPack} marks={marks} />
      <Shelf world={world} />
    </>
  );
}

function TopBar({ side, world }: { side: Side | "tome"; world: World }) {
  return (
    <header className="v4-top">
      <AppLink href="/" className="v4-brand">
        HedgeHug
      </AppLink>
      <nav className="v4-buttons" aria-label="Panels">
        {panelButtons.map((button) => (
          <AppLink key={button.side} href={button.href} className="v4-button-panel" aria-current={button.side === side ? "page" : undefined}>
            <kbd>{button.key}</kbd>
            {button.label}
            {button.side === "quests" && <span className="v4-tab-count">{world.quests.filter(({ state }) => state === "active").length}</span>}
          </AppLink>
        ))}
      </nav>
    </header>
  );
}

function useQuestCompletion(quests: Quest[], onComplete: () => void) {
  const [celebrating, setCelebrating] = useState<Quest | null>(null);
  const previous = useRef(quests);
  const latestOnComplete = useRef(onComplete);
  latestOnComplete.current = onComplete;
  useEffect(() => {
    const finishedNow = quests.find((quest) => quest.state === "finished" && previous.current.find(({ id }) => id === quest.id)?.state === "active");
    previous.current = quests;
    if (finishedNow === undefined) return;
    setCelebrating(finishedNow);
    latestOnComplete.current();
  }, [quests]);
  useEffect(() => {
    if (celebrating === null) return;
    const timer = window.setTimeout(() => setCelebrating(null), 2600);
    return () => window.clearTimeout(timer);
  }, [celebrating]);
  return celebrating;
}

function useHotkeys(paused: boolean, navigate: (href: string) => void) {
  useEffect(() => {
    if (paused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || typing(event.target)) return;
      const button = panelButtons.find(({ key }) => key === event.key.toUpperCase());
      if (button === undefined) return;
      event.preventDefault();
      navigate(button.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, navigate]);
}

function typing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
