// PROTOTYPE (#625): round 2 variant 2, World map: the game HUD over an explorable map of Hedgehog Land with free-floating windows. Never merge to main.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HedgehogCodingGroup, HedgehogReading } from "../../../hoggies";
import type { VariantProps } from "../../PrototypeStage";
import { useWorld, type PackKind, type Quest, type World } from "../../world";
import { useBag } from "./bag";
import { HoggieBook, TeamBook } from "./Books";
import { hoggieHashOf } from "./bookSpreads";
import { frontOf, hashOf, addressOf, resetPlacements, useDesk, useDeskRouting, useWindows, type WindowId } from "./desk";
import { FloatingWindow, type WindowSize } from "./FloatingWindow";
import { HallOfFame } from "./HallOfFame";
import { QuestScroll, Satchel, SystemMenu, UnitFrame, XpBar, questName } from "./hud";
import { Inventory } from "./Inventory";
import { Market } from "./Market";
import { LevelUpBanner, PackReveal, QuestCompleteBanner } from "./moments";
import { useClimb, useCountingTo } from "./motion";
import { Overworld, type Marker } from "./Overworld";
import { PostOffice, QuestLog, TownSquare } from "./panels";
import { landmarks, placeOfQuest, placeOfWindow, villagesOf, type LandmarkId, type PlaceId } from "./places";
import "./worldMap.css";

const sizes: Record<Exclude<WindowId, "hall">, WindowSize> = {
  bag: { width: 720, height: 580 },
  hoggies: { width: 840, height: 640 },
  teams: { width: 840, height: 640 },
  market: { width: 660, height: 540 },
  quests: { width: 660, height: 470 },
  activity: { width: 480, height: 540 },
  leaderboard: { width: 460, height: 580 },
  settings: { width: 860, height: 600 },
};

const titles: Record<Exclude<WindowId, "hall">, string> = {
  bag: "Inventory",
  hoggies: "The Hoggie book",
  teams: "The Team book",
  market: "The Market",
  quests: "Quest log",
  activity: "Post Office · Activity",
  leaderboard: "Town Square · Leaderboard",
  settings: "Settings",
};

type Reveal = { kind: PackKind; xpBefore: number };

export function WorldMap({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  useDeskRouting();
  const desk = useDesk();
  const windows = useWindows();
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const landing = reveal === null ? 900 : 2400;
  const climb = useClimb(world.level, landing);
  const coins = useCountingTo(world.coins, landing + 200);
  const coinGain = useLastChange(world.coins, landing + 200);
  const [bag, setBag] = useBag(world);
  const fresh = useFreshThings(world);
  const questBanner = useQuestCompletions(world.quests);
  const levelBanner = useLevelUps(climb.level);
  const bump = useBumps(world.packs.length);
  const [library, setLibrary] = useState(false);
  const [lit, setLit] = useState<PlaceId | null>(null);
  const villages = useMemo(() => villagesOf(world), [world.teams]);
  const settingsPage = useRef<ReactNode>(null);
  if (route.page === "settings") settingsPage.current = todaysPage;

  const front = frontOf(desk.open);
  const at = useTokenPlace(placeOfWindow(front, hashOf("teams")));
  const markers = markersOf(world);

  const openPack = (id: string) => {
    const pack = world.packs.find((each) => each.id === id);
    if (pack === undefined) return;
    setReveal({ kind: pack.kind, xpBefore: world.level.xp });
    actions.openPack(id);
  };
  const openHoggie = (slug: string) => windows.open("hoggies", `/book${hoggieHashOf(world, slug)}`);
  const openTeam = (team: string) => windows.open("teams", `/book#teams/${team}`);
  const collect = () => {
    actions.forgetLastDrop();
    setReveal(null);
  };

  const onPlace = (place: PlaceId) => {
    setLibrary(false);
    if (place.startsWith("village:")) return openTeam(place.slice("village:".length));
    const opens: Record<LandmarkId, WindowId | null> = { square: "leaderboard", market: "market", post: "activity", hall: "hall", library: null };
    const id = opens[place as LandmarkId];
    if (id === null) setLibrary(true);
    else windows.open(id);
  };

  const placeName = (quest: Quest) => {
    const place = placeOfQuest(quest, world);
    if (!place.startsWith("village:")) return landmarks[place as LandmarkId].name;
    return `${world.teams.find(({ team }) => `village:${team}` === place)?.name ?? "Team"} village`;
  };

  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keys.current = (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (world.lastDrop !== null) return collect();
    if (library) return setLibrary(false);
    if (desk.open.includes("hall") && hashOf("hall") !== "") return windows.turnTo("hall", "/book/earned");
    if (front !== null) windows.close(desk.open.includes("hall") ? "hall" : front);
  };
  useEffect(() => {
    const listen = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  const rank = world.board.find((row) => row.you)?.rank ?? null;
  const floating = desk.open.filter((id): id is Exclude<WindowId, "hall"> => id !== "hall");

  const bodyOf = (id: Exclude<WindowId, "hall">): ReactNode => {
    if (id === "bag") return <Inventory world={world} bag={bag} setBag={setBag} fresh={fresh} onOpenPack={openPack} onOpenHoggie={openHoggie} onOpenTeam={openTeam} />;
    if (id === "hoggies") return <HoggieBook world={world} hash={hashOf("hoggies")} front={front === "hoggies"} fresh={fresh} onTurnTo={(hash) => windows.turnTo("hoggies", `/book${hash}`)} />;
    if (id === "teams") return <TeamBook world={world} hash={hashOf("teams")} front={front === "teams"} onTurnTo={(hash) => windows.turnTo("teams", `/book${hash}`)} />;
    if (id === "market") return <Market coins={world.coins} price={world.store.price} packsWaiting={world.packs.length} onBuy={actions.buyPack} onOpenBag={() => windows.open("bag")} />;
    if (id === "quests") return <QuestLog quests={world.quests} placeName={placeName} onProgress={actions.progressQuest} onFinish={actions.finishQuest} onOpenReward={(questId) => openPack(`pack:${questId}`)} />;
    if (id === "activity") return <PostOffice received={world.received} given={world.given} address={addressOf("activity")} onFilter={(address) => windows.turnTo("activity", address)} />;
    if (id === "leaderboard") return <TownSquare board={world.board} />;
    return <div className="wm-settings">{settingsPage.current}</div>;
  };

  return (
    <div className="wm-world">
      <Overworld
        world={world}
        villages={villages}
        at={at}
        lit={lit}
        markers={markers}
        onPlace={onPlace}
        overlay={library && <LibrarySign onPick={(id) => (setLibrary(false), windows.open(id))} onClose={() => setLibrary(false)} />}
      />
      <UnitFrame me={world.me} climb={climb} coins={coins} coinGain={coinGain} />
      <SystemMenu rank={rank} open={desk.open} onOpen={windows.toggle} onReset={resetPlacements} onCloseAll={windows.closeAll} />
      <QuestScroll quests={world.quests} placeName={placeName} onLight={(quest) => setLit(quest === null ? null : placeOfQuest(quest, world))} onProgress={actions.progressQuest} onOpenReward={(questId) => openPack(`pack:${questId}`)} onOpenLog={() => windows.open("quests")} />
      <Satchel open={desk.open} packs={world.packs.length} bump={bump} onOpen={windows.toggle} />
      {floating.map((id) => (
        <FloatingWindow key={id} id={id} title={titles[id]} size={sizes[id]} dockable={id === "hoggies" || id === "teams"} className={`wm-window-${id}`} onClose={() => windows.close(id)} onFocus={() => windows.focus(id)} icon={id === "hoggies" ? <HedgehogReading size={26} /> : id === "teams" ? <HedgehogCodingGroup size={26} /> : undefined}>
          {bodyOf(id)}
        </FloatingWindow>
      ))}
      {desk.open.includes("hall") && <HallOfFame ladders={world.achievements} zoomed={hashOf("hall").slice(1) || null} onZoom={(ladder) => windows.turnTo("hall", ladder === null ? "/book/earned" : `/book/earned#${ladder}`)} onClose={() => windows.close("hall")} />}
      <XpBar climb={climb} xp={world.level.xp} landing={landing} />
      {questBanner !== null && <QuestCompleteBanner key={questBanner.id} name={questBanner.name} kind={questBanner.kind} />}
      {levelBanner !== null && <LevelUpBanner key={levelBanner} level={levelBanner} />}
      {world.lastDrop !== null && reveal !== null && (
        <PackReveal
          key={`${world.lastDrop.hoggie}:${world.lastDrop.copy}`}
          drop={world.lastDrop}
          kind={reveal.kind}
          xpBefore={reveal.xpBefore}
          onCollect={collect}
          onSeePage={() => {
            const slug = world.lastDrop!.hoggie;
            collect();
            openHoggie(slug);
          }}
        />
      )}
    </div>
  );
}

function LibrarySign({ onPick, onClose }: { onPick: (id: "hoggies" | "teams") => void; onClose: () => void }) {
  const [x, y] = landmarks.library.at;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  return (
    <div className="wm-library-sign" style={{ left: x, top: y - 120 }} role="dialog" aria-label="The Library: pick a book">
      <p className="wm-library-title">The Library</p>
      <div className="wm-library-books">
        <button ref={first} type="button" className="wm-library-book wm-library-book-hoggies" onClick={() => onPick("hoggies")}>
          <HedgehogReading size={54} />
          <span>Hoggie book</span>
        </button>
        <button type="button" className="wm-library-book wm-library-book-teams" onClick={() => onPick("teams")}>
          <HedgehogCodingGroup size={54} />
          <span>Team book</span>
        </button>
      </div>
      <button type="button" className="wm-library-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

function markersOf(world: World) {
  const markers = new Map<PlaceId, Marker[]>();
  for (const quest of world.quests) {
    if (quest.state === "claimed") continue;
    const place = placeOfQuest(quest, world);
    markers.set(place, [...(markers.get(place) ?? []), { source: quest.source, finished: quest.state === "finished" }]);
  }
  return markers;
}

function useTokenPlace(wanted: PlaceId | null) {
  const [at, setAt] = useState<PlaceId>(wanted ?? "square");
  useEffect(() => {
    if (wanted !== null) setAt(wanted);
  }, [wanted]);
  return at;
}

function useLastChange(value: number, lag: number) {
  const before = useRef(value);
  const lagging = useRef(lag);
  lagging.current = lag;
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    const delta = value - before.current;
    before.current = value;
    if (delta === 0) return;
    const show = window.setTimeout(() => setChange(delta), lagging.current);
    const hide = window.setTimeout(() => setChange(null), lagging.current + 1700);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [value]);
  return change;
}

function useFreshThings(world: World) {
  const knownPacks = useRef(new Set(world.packs.map(({ id }) => id)));
  const knownHoggies = useRef(new Set(world.hoggies.filter(({ count }) => count > 0).map(({ hoggie }) => hoggie)));
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const added = [...world.packs.map(({ id }) => id).filter((id) => !knownPacks.current.has(id)), ...world.hoggies.filter(({ count, hoggie }) => count > 0 && !knownHoggies.current.has(hoggie)).map(({ hoggie }) => hoggie)];
    if (added.length === 0) return;
    added.forEach((key) => (key.startsWith("pack:") ? knownPacks.current.add(key) : knownHoggies.current.add(key)));
    setFresh((current) => new Set([...current, ...added]));
  }, [world.packs, world.hoggies]);
  return fresh;
}

function useBumps(count: number) {
  const before = useRef(count);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (count > before.current) {
      const timer = window.setTimeout(() => setBump((current) => current + 1), 900);
      before.current = count;
      return () => window.clearTimeout(timer);
    }
    before.current = count;
  }, [count]);
  return bump;
}

type Completion = { id: string; name: string; kind: PackKind };

function useQuestCompletions(quests: Quest[]) {
  const before = useRef(new Map(quests.map((quest) => [quest.id, quest.state])));
  const [banner, setBanner] = useState<Completion | null>(null);
  useEffect(() => {
    const done = quests.find((quest) => quest.state === "finished" && before.current.get(quest.id) === "active");
    before.current = new Map(quests.map((quest) => [quest.id, quest.state]));
    if (done !== undefined) setBanner({ id: done.id, name: questName(done), kind: done.source });
  }, [quests]);
  useEffect(() => {
    if (banner === null) return;
    const timer = window.setTimeout(() => setBanner(null), 2800);
    return () => window.clearTimeout(timer);
  }, [banner]);
  return banner;
}

function useLevelUps(level: number) {
  const before = useRef(level);
  const [banner, setBanner] = useState<number | null>(null);
  useEffect(() => {
    if (level > before.current) setBanner(level);
    before.current = level;
  }, [level]);
  useEffect(() => {
    if (banner === null) return;
    const timer = window.setTimeout(() => setBanner(null), 2800);
    return () => window.clearTimeout(timer);
  }, [banner]);
  return banner;
}
