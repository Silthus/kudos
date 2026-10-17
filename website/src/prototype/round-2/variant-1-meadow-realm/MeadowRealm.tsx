// PROTOTYPE (#625): round 2 variant 1, Meadow realm: a WoW-style HUD over a living hedgehog village, books docked left, bags bottom right. Never merge to main.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { HedgehogClimber, HedgehogExplorer, HedgehogMailbox } from "../../../hoggies";
import type { VariantProps } from "../../PrototypeStage";
import { useWorld, type Pack, type Quest } from "../../world";
import { Achievements } from "./Achievements";
import { BagsHud } from "./Bags";
import { columnsOf, itemsOf, stackHeight, useBags } from "./bags";
import { Book } from "./Book";
import { hoggieHash, teamHash, type BookId } from "./books";
import { useClimb, useCoinPurse, useExpiring } from "./climb";
import { questName, QuestTracker, SystemMenu, UnitFrame, XpBar, type MicroId } from "./hud";
import { Merchant } from "./Merchant";
import { LevelUpBanner, QuestCompleteBanner, Reveal } from "./moments";
import { dockedAt, hrefOf, isTyping, openedOver, replaceAddress, useHudNavigation, useRerender, type CentreId, type LeftId } from "./navigation";
import { Scene } from "./Scene";
import { ActivityWindow, LeaderboardWindow, QuestLog, SettingsWindow } from "./windows";
import "./meadow.css";

type Remembered = { id: LeftId; hash: string };

const microKeys: Record<string, MicroId> = { h: "hoggies", t: "teams", q: "quests", a: "achievements", v: "store", c: "activity", l: "leaderboard", o: "settings" };

const centreIds: readonly MicroId[] = ["store", "achievements", "settings"];

export function MeadowRealm({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const nav = useHudNavigation();
  const rerender = useRerender();
  const viewport = useViewport();
  const held = world.lastDrop !== null;
  const climb = useClimb(world.level, held);
  const purse = useCoinPurse(world.coins, held);
  const items = useMemo(() => itemsOf(world), [world]);
  const bags = useBags(items);
  const remembered = useRef<Remembered | null>(null);
  const [opening, setOpening] = useState<Pack["kind"]>("bought");
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const questBanner = useExpiring(useQuestCompletion(world.quests), 3200);
  const levelBanner = useExpiring(climb.levelledAt, 2800);

  const routed = dockedAt(route, window.location.hash);
  if (routed.left !== null) remembered.current = { id: routed.left, hash: window.location.hash };
  else if (routed.centre === null) remembered.current = null;
  const left = routed.left ?? (routed.centre !== null ? (remembered.current?.id ?? null) : null);
  const centre = routed.centre;
  const leftHash = routed.left !== null ? window.location.hash : (remembered.current?.hash ?? "");

  const stacks = columnsOf(bags.bags, bags.arranged, Math.max(280, viewport.height - 520));
  const bagsTop = stacks.length === 0 ? 0 : stackHeight(stacks[0]!, bags.arranged) + 12;
  const trackerRoom = Math.max(140, viewport.height - 132 - 172 - bagsTop);

  const openLeft = (id: LeftId, hash?: string) => {
    if (left === id && hash === undefined) return closeLeft();
    nav.open(hash === undefined ? hrefOf[id] : `/book${hash}`, null);
  };
  const closeLeft = () => {
    if (centre === null) return nav.home();
    remembered.current = null;
    rerender();
  };
  const openCentre = (id: CentreId) => (centre === id ? closeCentre() : nav.open(hrefOf[id], left));
  const closeCentre = () => (left !== null && openedOver() !== null ? nav.back() : nav.home());
  const openMicro = (id: MicroId) => (centreIds.includes(id) ? openCentre(id as CentreId) : openLeft(id as LeftId));

  const onBookHash = useCallback(
    (hash: string) => {
      if (routed.centre === null) replaceAddress(`/book${hash}`);
      else if (remembered.current !== null) remembered.current = { ...remembered.current, hash };
      rerender();
    },
    [routed.centre, rerender],
  );
  const switchBook = (book: BookId) => (centre === null ? nav.open(hrefOf[book], null) : onBookHash(hrefOf[book].replace("/book", "")));

  const light = (key: string) => {
    setSpotlight(key);
    window.setTimeout(() => setSpotlight((current) => (current === key ? null : current)), 4000);
  };
  const findHoggie = (slug: string) => {
    light(slug);
    openLeft("hoggies", hoggieHash(world, slug));
  };
  const openTeam = (team: string, person: string | null) => {
    if (person !== null) light(person);
    openLeft("teams", teamHash(team));
  };
  const openPack = (id: string) => {
    const pack = world.packs.find((each) => each.id === id);
    if (pack === undefined) return;
    setOpening(pack.kind);
    actions.openPack(id);
  };
  const openReward = (questId: string) => openPack(`pack:${questId}`);

  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keys.current = (event) => {
    if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") return escape();
    if (held) return;
    if (event.key.toLowerCase() === "b") return bags.toggleAll();
    const micro = microKeys[event.key.toLowerCase()];
    if (micro !== undefined) openMicro(micro);
  };
  const escape = () => {
    if (held) return actions.forgetLastDrop();
    if (centre !== null) return closeCentre();
    if (left !== null) return closeLeft();
    bags.closeAll();
  };
  useEffect(() => {
    const listen = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  const open = new Set<MicroId>([left, centre].filter((id): id is LeftId | CentreId => id !== null));
  const rank = world.board.find((row) => row.you)?.rank ?? null;
  const drop = world.lastDrop;
  const style = { "--mr-book-scale": bookScale(viewport), "--mr-left-room": left === null ? "0px" : `${Math.round(720 * bookScale(viewport)) + 32}px` } as CSSProperties;

  return (
    <div className={`mr-root ${left !== null ? "mr-has-left" : ""}`} style={style}>
      <Scene name={world.me.name} level={climb.level} merchantOpen={centre === "store"} onMerchant={() => openCentre("store")} />
      <UnitFrame me={world.me} climb={climb} purse={purse} />
      <SystemMenu rank={rank} open={open} packs={world.packs.length} onOpen={openMicro} />
      <QuestTracker quests={world.quests} maxHeight={trackerRoom} onProgress={actions.progressQuest} onOpenReward={openReward} onOpenLog={() => openLeft("quests")} />
      <BagsHud state={bags} stacks={stacks} onOpenPack={openPack} onFindHoggie={findHoggie} onOpenTeam={openTeam} />
      <XpBar climb={climb} />
      {left !== null && (
        <div className="mr-dock-left" key={left}>
          {(left === "hoggies" || left === "teams") && <Book book={left} hash={leftHash.startsWith(`#${left}`) ? leftHash : `#${left}`} world={world} spotlight={spotlight} keysOn={!held} onHash={onBookHash} onSwitch={switchBook} onClose={closeLeft} />}
          {left === "quests" && <QuestLog quests={world.quests} icon={<HedgehogExplorer size={34} />} onClose={closeLeft} onProgress={actions.progressQuest} onFinish={actions.finishQuest} onOpenReward={openReward} />}
          {left === "activity" && <ActivityWindow received={world.received} given={world.given} icon={<HedgehogMailbox size={30} />} onClose={closeLeft} />}
          {left === "leaderboard" && <LeaderboardWindow board={world.board} icon={<HedgehogClimber size={30} />} onClose={closeLeft} />}
        </div>
      )}
      {centre !== null && (
        <div className="mr-dock-centre" key={centre}>
          {centre === "store" && <Merchant coins={world.coins} price={world.store.price} onBuy={actions.buyPack} onClose={closeCentre} />}
          {centre === "achievements" && <Achievements ladders={world.achievements} onClose={closeCentre} />}
          {centre === "settings" && <SettingsWindow page={todaysPage} icon={<span className="mr-gear-icon">⚙</span>} onClose={closeCentre} />}
        </div>
      )}
      {questBanner !== null && <QuestCompleteBanner key={questBanner.id} name={questBanner.name} pack={questBanner.pack} />}
      {levelBanner !== null && !held && <LevelUpBanner key={levelBanner} level={levelBanner} />}
      {drop !== null && (
        <Reveal
          key={`${drop.hoggie}:${drop.copy}`}
          drop={drop}
          pack={opening}
          xpBefore={world.level.xp - drop.xp}
          onCollect={actions.forgetLastDrop}
          onSeeInBook={() => {
            actions.forgetLastDrop();
            findHoggie(drop.hoggie);
          }}
        />
      )}
    </div>
  );
}

type Completion = { id: string; name: string; pack: Pack["kind"] };

function useQuestCompletion(quests: Quest[]) {
  const before = useRef(new Map(quests.map((quest) => [quest.id, quest.state])));
  const [completion, setCompletion] = useState<Completion | null>(null);
  useEffect(() => {
    const done = quests.find((quest) => quest.state === "finished" && before.current.get(quest.id) === "active");
    before.current = new Map(quests.map((quest) => [quest.id, quest.state]));
    if (done !== undefined) setCompletion({ id: done.id, name: questName(done), pack: done.source });
  }, [quests]);
  return completion;
}

type Viewport = { width: number; height: number };

function useViewport(): Viewport {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return viewport;
}

function bookScale({ width, height }: Viewport) {
  return Math.min(1, (height - 250) / 620, (width - 24) / 720);
}
