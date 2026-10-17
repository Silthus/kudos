// PROTOTYPE (#625) round 2 variant 4, Guild hall: the Game HUD inside a sunlit guild hall, with panels that snap into left, centre and right docks. Never merge to main.
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "../../../AppLink";
import type { VariantProps } from "../../PrototypeStage";
import { useWorld, type Quest, type World } from "../../world";
import { Achievements } from "./Achievements";
import { bookHref, centreHref, isTyping, layoutOf, useAddressChanges, type BookId, type CentreId } from "./address";
import { bagReducer, initialBag, itemsOf } from "./bag";
import { DockedBook } from "./Book";
import { hoggieHashOf } from "./books";
import { Hall } from "./Hall";
import { CompactTracker, MicroMenu, UnitFrame, XpBar, menuIcons, questName, trackedQuests, type MenuEntry } from "./hud";
import { Inventory } from "./Inventory";
import { LevelUpBurst, PackReveal, QuestCompleteBanner, type Reveal } from "./moments";
import { useClimb, useGains, useLagging, useMoment } from "./motion";
import { ActivityPanel, CentreDock, LeaderboardPanel, QuestBoardPanel, SettingsPanel } from "./panels";
import { Store } from "./Store";
import "./guildHall.css";

const lastPageOf: Record<BookId, string> = { hoggies: bookHref.hoggies, teams: bookHref.teams };

let bagOpenedWithTheBook = false;

export function GuildHall({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const navigate = useNavigate();
  const rerender = useAddressChanges();
  const layout = layoutOf(route, window.location.hash);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const climb = useClimb(world.level, reveal === null ? 900 : 2300);
  const gains = useGains(useLagging(world.level.xp, reveal === null ? 900 : 2300), 1900);
  const coins = useLagging(world.coins, 1100);
  const scale = useScreenScale();
  const [bagOpen, setBagOpen] = useState(false);
  const [bag, dispatch] = useReducer(bagReducer, undefined, initialBag);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const docked = useDockedCentre(layout.centre);
  const fresh = useFreshItems(world);
  const questBanner = useQuestCompletions(world.quests);
  const [levelBanner, showLevelBanner] = useMoment<number>(null, 2600);

  useEffect(() => {
    if (climb.burst > 0) showLevelBanner(climb.level);
  }, [climb.burst]);

  if (layout.book !== null) lastPageOf[layout.book] = `/book${window.location.hash}`;

  useEffect(() => {
    if (layout.book === null || bagOpenedWithTheBook) return;
    bagOpenedWithTheBook = true;
    setBagOpen(true);
  }, [layout.book]);

  const go = useCallback((href: string) => navigate(href), [navigate]);
  const toHome = () => go("/");
  const openBook = (book: BookId) => go(layout.book === book ? "/" : lastPageOf[book]);
  const openCentre = (centre: CentreId) => go(layout.centre === centre ? "/" : centreHref[centre]);
  const openTeamPage = (team: string) => go(`/book#teams/${team}`);
  const openHoggiePage = (slug: string) => {
    setSpotlight(slug);
    go(`/book${hoggieHashOf(world, slug)}`);
  };

  const openPack = (id: string) => {
    const pack = world.packs.find((entry) => entry.id === id);
    if (pack === undefined) return;
    const beforeXp = world.level.xp;
    const drop = actions.openPack(id);
    if (drop !== null) setReveal({ drop, beforeXp, kind: pack.kind });
  };
  const openReward = (questId: string) => openPack(`pack:${questId}`);
  const collect = () => {
    if (reveal !== null) setSpotlight(reveal.drop.hoggie);
    actions.forgetLastDrop();
    setReveal(null);
  };
  const seeRevealedPage = () => {
    if (reveal === null) return;
    const slug = reveal.drop.hoggie;
    collect();
    openHoggiePage(slug);
  };

  const closeCentreTab = (id: CentreId) => {
    const rest = docked.remove(id);
    if (layout.centre !== id) return;
    const next = rest.at(-1);
    go(next === undefined ? "/" : centreHref[next]);
  };
  const closeCentre = () => {
    docked.clear();
    toHome();
  };

  const entries: MenuEntry[] = [
    { id: "hoggies", label: "Hoggies book", key: "H", icon: menuIcons.hoggies, on: layout.book === "hoggies", onUse: () => openBook("hoggies") },
    { id: "teams", label: "Team book", key: "T", icon: menuIcons.teams, on: layout.book === "teams", onUse: () => openBook("teams") },
    { id: "bag", label: "Bag", key: "B", icon: menuIcons.bag, on: bagOpen, badge: world.packs.length, onUse: () => setBagOpen(!bagOpen) },
    { id: "store", label: "Shop", key: "S", icon: menuIcons.store, on: layout.centre === "store", onUse: () => openCentre("store") },
    { id: "achievements", label: "Achievements", key: "A", icon: menuIcons.achievements, on: layout.centre === "achievements", onUse: () => openCentre("achievements") },
    { id: "quests", label: "Quest board", key: "Q", icon: menuIcons.quests, on: layout.centre === "quests", badge: world.quests.filter(({ state }) => state === "finished").length, onUse: () => openCentre("quests") },
    { id: "activity", label: "Activity", key: "J", icon: menuIcons.activity, on: layout.centre === "activity", onUse: () => openCentre("activity") },
    { id: "leaderboard", label: "Leaderboard", key: "L", icon: menuIcons.leaderboard, on: layout.centre === "leaderboard", onUse: () => openCentre("leaderboard") },
    { id: "settings", label: "Settings", key: "O", icon: menuIcons.settings, on: layout.centre === "settings", onUse: () => openCentre("settings") },
  ];

  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keys.current = (event) => {
    if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") return escape();
    if (reveal !== null) return;
    const entry = entries.find(({ key }) => key.toLowerCase() === event.key.toLowerCase());
    entry?.onUse();
  };
  const escape = () => {
    if (reveal !== null) return collect();
    if (layout.centre !== null || layout.book !== null) return toHome();
    if (bagOpen) setBagOpen(false);
  };
  useEffect(() => {
    const listen = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  const covered = layout.book !== null || (layout.centre !== null && layout.centre !== "quests");
  const rank = world.board.find((row) => row.you)?.rank ?? null;

  return (
    <div className="gh-root">
      <div className="gh-screen" style={{ "--gh-scale": scale } as CSSProperties}>
        <Hall
          world={world}
          receded={layout.centre !== null}
          onTeam={openTeamPage}
          onHoggiesBook={() => openBook("hoggies")}
          onTeamBook={() => openBook("teams")}
          onStore={() => openCentre("store")}
          onTrophies={() => openCentre("achievements")}
          onBoard={() => openCentre("quests")}
          onProgress={actions.progressQuest}
          onOpenReward={openReward}
        />
        <UnitFrame me={world.me} climb={climb} coins={coins} />
        <MicroMenu entries={entries} rank={rank} onRank={() => openCentre("leaderboard")} />
        <div className={`gh-stage ${covered ? "gh-stage-covered" : ""}`}>
          {layout.book !== null && (
            <div className="gh-zone gh-zone-left">
              <DockedBook book={layout.book} world={world} spotlight={spotlight} listening={reveal === null} onBook={(book) => go(lastPageOf[book])} onClose={toHome} onFlipped={rerender} />
            </div>
          )}
          {layout.centre !== null && (
            <div className="gh-zone gh-zone-centre">
              <CentreDock active={layout.centre} docked={docked.list.includes(layout.centre) ? docked.list : [...docked.list, layout.centre]} onTab={(id) => go(centreHref[id])} onCloseTab={closeCentreTab} onClose={closeCentre}>
                {layout.centre === "store" && <Store coins={world.coins} price={world.store.price} waiting={world.packs.length} onBuy={actions.buyPack} onOpenBag={() => setBagOpen(true)} />}
                {layout.centre === "achievements" && <Achievements ladders={world.achievements} />}
                {layout.centre === "quests" && <QuestBoardPanel quests={world.quests} onProgress={actions.progressQuest} onFinish={actions.finishQuest} onOpenReward={openReward} />}
                {layout.centre === "activity" && <ActivityPanel received={world.received} given={world.given} />}
                {layout.centre === "leaderboard" && <LeaderboardPanel board={world.board} />}
                {layout.centre === "settings" && <SettingsPanel page={todaysPage} />}
              </CentreDock>
            </div>
          )}
          {covered && (
            <div className="gh-zone gh-zone-tracker">
              <CompactTracker quests={trackedQuests(world.quests)} onProgress={actions.progressQuest} onOpenReward={openReward} onOpenBoard={() => openCentre("quests")} />
            </div>
          )}
          {bagOpen && (
            <div className="gh-zone gh-zone-right">
              <Inventory world={world} bag={bag} dispatch={dispatch} fresh={fresh} onOpenPack={openPack} onHoggiePage={openHoggiePage} onTeamPage={openTeamPage} onClose={() => setBagOpen(false)} />
            </div>
          )}
        </div>
        <XpBar climb={climb} gains={gains} />
        {questBanner !== null && <QuestCompleteBanner key={questBanner.id} name={questBanner.name} />}
        {levelBanner !== null && reveal === null && <LevelUpBurst key={`level-${levelBanner}`} level={levelBanner} />}
        {reveal !== null && <PackReveal key={`${reveal.drop.hoggie}:${reveal.drop.copy}`} reveal={reveal} onCollect={collect} onSeePage={seeRevealedPage} />}
      </div>
    </div>
  );
}

function useDockedCentre(active: CentreId | null) {
  const [list, setList] = useState<CentreId[]>(active === null ? [] : [active]);
  useEffect(() => {
    if (active !== null) setList((current) => (current.includes(active) ? current : [...current, active]));
  }, [active]);
  const remove = (id: CentreId) => {
    const rest = list.filter((entry) => entry !== id);
    setList(rest);
    return rest;
  };
  return { list, remove, clear: () => setList([]) };
}

function useFreshItems(world: World) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const now = new Set(itemsOf(world).map(({ key }) => key));
    const before = seen.current;
    seen.current = now;
    if (before === null) return;
    const added = [...now].filter((key) => !before.has(key));
    if (added.length === 0) return;
    setFresh((current) => new Set([...current, ...added]));
    window.setTimeout(() => setFresh((current) => new Set([...current].filter((key) => !added.includes(key)))), 12_000);
  }, [world]);
  return fresh;
}

type Completion = { id: string; name: string };

function useQuestCompletions(quests: Quest[]) {
  const before = useRef(new Map(quests.map((quest) => [quest.id, quest.state])));
  const [banner, setBanner] = useMoment<Completion>(null, 2800);
  useEffect(() => {
    const done = quests.find((quest) => quest.state === "finished" && before.current.get(quest.id) === "active");
    before.current = new Map(quests.map((quest) => [quest.id, quest.state]));
    if (done !== undefined) setBanner({ id: done.id, name: questName(done) });
  }, [quests]);
  return banner;
}

const designWidth = 1440;

const designHeight = 900;

const phoneWidth = 760;

function scaleFor(width: number, height: number) {
  if (width < phoneWidth) return 1;
  return Math.min(width / designWidth, height / designHeight);
}

function useScreenScale() {
  const [scale, setScale] = useState(() => scaleFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const resize = () => setScale(scaleFor(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return scale;
}
