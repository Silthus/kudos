// PROTOTYPE (#625): round 2 variant 3, Sky island: a floating home island with slide-in drawers for books and inventory. Never merge to main.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Route } from "../../../route";
import type { TierId } from "../../../shell";
import type { VariantProps } from "../../PrototypeStage";
import { useWorld, type PackKind, type Quest } from "../../world";
import { BooksDrawer } from "./BooksDrawer";
import { bookOfHash, hashOfHoggie } from "./books";
import { CapsuleStore } from "./CapsuleStore";
import { useClimb, useExpiring, useTicking } from "./climb";
import { GearIcon, LetterIcon, PodiumIcon, ScrollIcon, SystemButtons, TrophyIcon, UnitFrame, XpBar } from "./Hud";
import { InventoryDrawer } from "./InventoryDrawer";
import { itemsOf, useInventory } from "./inventory";
import { questName } from "./looks";
import { LevelUpBurst, PackReveal, QuestComplete } from "./Moments";
import { isTyping, replaceAddress, useAddressChanges, useSkyNavigation } from "./navigation";
import { QuestBubbles } from "./QuestBubbles";
import { HomeIsland, SkyBackdrop, type AvatarBeat } from "./SkyWorld";
import { AchievementToast, closestOf, TrophyCabinet, withEarned, type Earned } from "./TrophyCabinet";
import { ActivityWindow, LeaderboardWindow, QuestLog, SettingsWindow } from "./Windows";
import "./skyIsland.css";

type ModalId = "store" | "trophies" | "quests" | "activity" | "leaderboard" | "settings";

const modalPages: readonly string[] = ["quests", "activity", "leaderboard", "settings"];

function modalOf(route: Route, hash: string): ModalId | null {
  if (route.page === "book" && route.bookPage === "earned") return "trophies";
  if (route.page === "book" && hash === "#store") return "store";
  return modalPages.includes(route.page) ? (route.page as ModalId) : null;
}

function bookHashOf(route: Route, hash: string, modal: ModalId | null) {
  if (route.page !== "book" || modal !== null) return null;
  return bookOfHash(hash) === null ? "#hoggies" : hash;
}

let bookUnderneath: string | null = null;

let lastBookHash = "#hoggies";

export function SkyIsland({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const { open, close } = useSkyNavigation();
  const rerender = useAddressChanges();
  const hash = window.location.hash;
  const modal = modalOf(route, hash);
  const bookHash = bookHashOf(route, hash, modal);
  if (bookHash !== null) {
    bookUnderneath = bookHash;
    lastBookHash = bookHash;
  } else if (modal === null) bookUnderneath = null;
  const booksOpen = bookHash !== null || (modal !== null && bookUnderneath !== null);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const inventory = useInventory(world);
  const fresh = useFreshKeys(world);
  const climb = useClimb(world.level);
  const coins = useTicking(world.coins, { delay: 1500 });
  const zoom = useDrawerZoom();
  const [spotlight, setSpotlight] = useExpiring<string>(2600);
  const [beat, setBeat] = useState<AvatarBeat>(null);
  const completion = useQuestCompletions(world.quests);
  const [levelBurst, setLevelBurst] = useExpiring<number>(2600);
  const [revealKind, setRevealKind] = useState<PackKind>("weekly");
  const [earned, setEarned] = useState<Earned[]>([]);
  const [toast, setToast] = useExpiring<{ ladder: string; tier: TierId; serial: number }>(4200);
  const ladders = useMemo(() => withEarned(world.achievements, earned), [world.achievements, earned]);

  const shownLevel = useRef(climb.level);
  useEffect(() => {
    if (climb.level > shownLevel.current) setLevelBurst(climb.level);
    shownLevel.current = climb.level;
  }, [climb.level, setLevelBurst]);

  const gainSerial = climb.gain?.serial ?? 0;
  const levelledTo = climb.gain?.levelledTo ?? null;
  useEffect(() => {
    if (gainSerial > 0) setBeat({ serial: gainSerial * 2, kind: levelledTo === null ? "jump" : "cheer" });
  }, [gainSerial, levelledTo]);
  useEffect(() => {
    if (completion.banner !== null) setBeat((current) => ({ serial: (current?.serial ?? 0) + 1, kind: "jump" }));
  }, [completion.banner]);

  const closeModal = () => close(bookUnderneath === null ? "/" : `/book${bookUnderneath}`);
  const openModal = (href: string) => (modal === null ? open(href) : (replaceAddress(href), rerender()));
  const flip = (next: string) => {
    if (bookHash === null) return open(`/book${next}`);
    replaceAddress(`/book${next}`);
    rerender();
  };
  const closeBooks = () => (modal === null ? close("/") : open("/"));
  const toggleBooks = () => (booksOpen ? closeBooks() : open(`/book${lastBookHash}`));
  const showInBook = (next: string, lit: string) => {
    setSpotlight(lit);
    flip(next);
  };
  const openPack = (id: string) => {
    const pack = world.packs.find((each) => each.id === id);
    if (pack === undefined) return;
    setRevealKind(pack.kind);
    actions.openPack(id);
  };
  const openReward = (questId: string) => openPack(`pack:${questId}`);
  const seeDropPage = () => {
    const drop = world.lastDrop;
    actions.forgetLastDrop();
    if (drop !== null) showInBook(hashOfHoggie(world, drop.hoggie), drop.hoggie);
  };
  const simulateEarning = () => {
    const closest = closestOf(ladders);
    if (closest === null || closest.next === null) return;
    const won = { ladder: closest.ladder, tier: closest.next.tier };
    setEarned((current) => [...current, { ...won, at: Date.now() }]);
    setToast({ ...won, serial: Date.now() });
  };

  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keys.current = (event) => {
    if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") return escape();
    if (world.lastDrop !== null || modal !== null) return;
    const key = event.key.toLowerCase();
    if (key === "b") toggleBooks();
    else if (key === "i") setInventoryOpen((shown) => !shown);
    else if (key === "q") openModal("/quests");
    else if (key === "t") openModal("/book/earned");
  };
  const escape = () => {
    if (world.lastDrop !== null) return actions.forgetLastDrop();
    if (modal !== null) return closeModal();
    if (bookHash !== null) return closeBooks();
    if (inventoryOpen) setInventoryOpen(false);
  };
  useEffect(() => {
    const listen = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  const rank = world.board.find((row) => row.you)?.rank ?? null;
  const toastLadder = toast === null ? undefined : ladders.find((ladder) => ladder.ladder === toast.ladder);

  return (
    <div className="sk-sky" data-books={booksOpen || undefined} data-inventory={inventoryOpen || undefined} data-revealing={world.lastDrop !== null || undefined} style={{ "--sk-zoom": zoom } as CSSProperties}>
      <SkyBackdrop world={world} onTeam={(team) => showInBook(`#teams/${team}`, team)} />
      <main className="sk-stage">
        <HomeIsland world={world} beat={beat} onHome={() => open(`/book${lastBookHash}`)} onStash={() => setInventoryOpen(true)} onBalloon={() => openModal("/book#store")} onSign={openModal} />
        <QuestBubbles quests={world.quests} popping={completion.popping} onProgress={actions.progressQuest} onOpenReward={openReward} onOpenLog={() => openModal("/quests")} />
      </main>
      <BooksDrawer world={world} open={booksOpen} hash={bookHash ?? bookUnderneath ?? lastBookHash} spotlight={spotlight} arrowKeys={bookHash !== null && world.lastDrop === null} onToggle={toggleBooks} onFlip={flip} onClose={closeBooks} />
      <InventoryDrawer world={world} open={inventoryOpen} inventory={inventory} fresh={fresh} onToggle={() => setInventoryOpen(!inventoryOpen)} onClose={() => setInventoryOpen(false)} onOpenPack={openPack} onShowInBook={showInBook} />
      <UnitFrame me={world.me} climb={climb} coins={coins} />
      <SystemButtons
        buttons={[
          { key: "quests", label: "Quest log", icon: <ScrollIcon />, active: modal === "quests", onUse: () => (modal === "quests" ? closeModal() : openModal("/quests")) },
          { key: "trophies", label: "Trophies", icon: <TrophyIcon />, active: modal === "trophies", onUse: () => (modal === "trophies" ? closeModal() : openModal("/book/earned")) },
          { key: "leaderboard", label: "Leaderboard", icon: <PodiumIcon />, tally: rank === null ? undefined : `#${rank}`, active: modal === "leaderboard", onUse: () => (modal === "leaderboard" ? closeModal() : openModal("/leaderboard")) },
          { key: "activity", label: "Activity", icon: <LetterIcon />, active: modal === "activity", onUse: () => (modal === "activity" ? closeModal() : openModal("/activity")) },
          { key: "settings", label: "Settings", icon: <GearIcon />, active: modal === "settings", onUse: () => (modal === "settings" ? closeModal() : openModal("/settings")) },
        ]}
      />
      <XpBar climb={climb} />
      {modal === "store" && <CapsuleStore world={world} onClose={closeModal} onBuy={actions.buyPack} onOpenPack={openPack} />}
      {modal === "trophies" && <TrophyCabinet ladders={ladders} onClose={closeModal} onSimulate={simulateEarning} />}
      {modal === "quests" && <QuestLog quests={world.quests} onClose={closeModal} onProgress={actions.progressQuest} onFinish={actions.finishQuest} onOpenReward={openReward} />}
      {modal === "activity" && <ActivityWindow received={world.received} given={world.given} onClose={closeModal} />}
      {modal === "leaderboard" && <LeaderboardWindow board={world.board} onClose={closeModal} />}
      {modal === "settings" && <SettingsWindow page={todaysPage} onClose={closeModal} />}
      {completion.banner !== null && <QuestComplete key={completion.banner.id} name={completion.banner.name} kind={completion.banner.kind} />}
      {levelBurst !== null && <LevelUpBurst key={levelBurst} level={levelBurst} />}
      {toast !== null && toastLadder !== undefined && <AchievementToast key={toast.serial} ladder={toastLadder} tier={toast.tier} onOpen={() => openModal("/book/earned")} />}
      {world.lastDrop !== null && <PackReveal key={`${world.lastDrop.hoggie}:${world.lastDrop.copy}`} drop={world.lastDrop} kind={revealKind} onCollect={actions.forgetLastDrop} onSeePage={seeDropPage} />}
    </div>
  );
}

function useFreshKeys(world: ReturnType<typeof useWorld>["world"]) {
  const initial = useRef<ReadonlySet<string> | null>(null);
  initial.current ??= new Set(itemsOf(world).map(({ key }) => key));
  const known = initial.current;
  return useMemo(() => new Set(itemsOf(world).flatMap(({ key }) => (known.has(key) ? [] : [key]))), [world, known]);
}

type Completion = { id: string; name: string; kind: PackKind };

function useQuestCompletions(quests: Quest[]) {
  const before = useRef(new Map(quests.map((quest) => [quest.id, quest.state])));
  const [banner, setBanner] = useExpiring<Completion>(3000);
  const [popping, setPopping] = useExpiring<string>(900);
  useEffect(() => {
    const done = quests.find((quest) => quest.state === "finished" && before.current.get(quest.id) === "active");
    before.current = new Map(quests.map((quest) => [quest.id, quest.state]));
    if (done === undefined) return;
    setBanner({ id: done.id, name: questName(done), kind: done.source });
    setPopping(done.id);
  }, [quests, setBanner, setPopping]);
  return { banner, popping };
}

function zoomFor(height: number) {
  return Math.max(0.6, Math.min(1, (height - 214) / 690));
}

function useDrawerZoom() {
  const [zoom, setZoom] = useState(() => zoomFor(window.innerHeight));
  useEffect(() => {
    const resize = () => setZoom(zoomFor(window.innerHeight));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return zoom;
}
