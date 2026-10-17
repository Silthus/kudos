// PROTOTYPE (#625): variant 1, Game HUD: an MMO screen layered around one open book. Never merge to main.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { HedgehogExplorer, HedgehogMailbox, HedgehogMoney, HedgehogStar, HedgehogSuccess, HedgehogClimber } from "../../hoggies";
import type { Route } from "../../route";
import type { VariantProps } from "../PrototypeStage";
import { CrestArt } from "../art";
import { useWorld, type Quest } from "../world";
import { Book, ClosedBook } from "./Book";
import { Hotbar, QuestTracker, SystemMenu, UnitFrame, XpBar, questName, type Slot } from "./hud";
import { isTyping, replaceAddress, useAddressChanges, useHudNavigation } from "./hudNavigation";
import { LevelUpBanner, LootReveal, QuestCompleteBanner } from "./moments";
import { firstSpreadOf, spreadIndexAt, spreadsOf, type Chapter } from "./spreads";
import { useClimb } from "./useClimb";
import { ActivityWindow, LeaderboardWindow, QuestLog, SettingsWindow } from "./windows";
import "./hud.css";

type HudWindowId = "quests" | "activity" | "leaderboard" | "settings";

const windowPages: readonly string[] = ["quests", "activity", "leaderboard", "settings"];

function windowOf(route: Route): HudWindowId | null {
  return windowPages.includes(route.page) ? (route.page as HudWindowId) : null;
}

const rarityChapters: readonly Chapter[] = ["common", "uncommon", "rare", "epic", "legendary"];

let lastBookHref: string | null = null;

export function GameHud({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const { go, openWindow, closeWindow } = useHudNavigation();
  const rerender = useAddressChanges();
  const climb = useClimb(world.level);
  const coins = useLagging(world.coins, 1100);
  const scale = useBookScale();
  const questBanner = useQuestCompletions(world.quests);
  const levelBanner = useLevelUps(climb.level);
  const [pressed, press] = useFlash();

  const bookActions = useMemo(() => ({ buyPack: () => void actions.buyPack(), openPack: (id: string) => void actions.openPack(id) }), [actions]);
  const spreads = spreadsOf(world, bookActions);
  const bookOpen = route.page === "book";
  const index = bookOpen ? spreadIndexAt(spreads, window.location) : 0;
  const chapter = bookOpen ? spreads[index]!.chapter : null;
  const hudWindow = windowOf(route);
  if (bookOpen) lastBookHref = spreads[index]!.href;

  const flip = (next: number) => {
    const spread = spreads[next];
    if (spread === undefined) return;
    replaceAddress(spread.href);
    rerender();
  };
  const toggleBook = (href: string, open: boolean) => go(open ? "/" : href);
  const toggleWindow = (id: HudWindowId) => (hudWindow === id ? closeWindow() : openWindow(`/${id}`));
  const openReward = (questId: string) => actions.openPack(`pack:${questId}`);

  const slots: Slot[] = [
    { key: "1", label: "Hoggies", hint: "Your hoggies, page by rarity", icon: <HedgehogStar size={40} />, active: chapter !== null && rarityChapters.includes(chapter), onUse: () => toggleBook(firstSpreadOf(spreads, "common"), chapter !== null && rarityChapters.includes(chapter)) },
    { key: "2", label: "Team pages", hint: "One sticker per teammate you thanked", icon: <CrestArt art={{ kind: "crest", slug: "workflows" }} size={38} />, active: chapter === "teams", onUse: () => toggleBook(firstSpreadOf(spreads, "teams"), chapter === "teams") },
    { key: "3", label: "Achievements", hint: "Ladders and medals you earned", icon: <HedgehogSuccess size={40} />, active: chapter === "achievements", onUse: () => toggleBook("/book/earned", chapter === "achievements") },
    { key: "4", label: "Packs & store", hint: "Open your packs, buy more for 50 coins", icon: <HedgehogMoney size={40} />, active: chapter === "store", waiting: world.packs.length, onUse: () => toggleBook("/book#store", chapter === "store") },
    { key: "5", label: "Activity", hint: "Kudos you gave and received", icon: <HedgehogMailbox size={40} />, active: hudWindow === "activity", onUse: () => toggleWindow("activity") },
    { key: "L", label: "Leaderboard", hint: "This week's most generous", icon: <HedgehogClimber size={30} />, active: hudWindow === "leaderboard", small: true, onUse: () => toggleWindow("leaderboard") },
  ];

  const keys = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keys.current = (event) => {
    if (isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape") return escape();
    if (world.lastDrop !== null) return;
    if (bookOpen && event.key === "ArrowLeft") return flip(index - 1);
    if (bookOpen && event.key === "ArrowRight") return flip(index + 1);
    if (event.key.toLowerCase() === "q") return toggleWindow("quests");
    const slot = slots.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase());
    if (slot === undefined) return;
    press(slot.key);
    slot.onUse();
  };
  const escape = () => {
    if (world.lastDrop !== null) return actions.forgetLastDrop();
    if (hudWindow !== null) return closeWindow();
    if (bookOpen) go("/");
  };
  useEffect(() => {
    const listen = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  const rank = world.board.find((row) => row.you)?.rank ?? null;

  return (
    <div className="v1-hud" style={{ "--v1-scale": scale } as CSSProperties}>
      <Meadow />
      <main className="v1-stage">
        <div className="v1-book-scaler">
          {bookOpen ? <Book spreads={spreads} index={index} onFlip={flip} onChapter={go} /> : <ClosedBook name={world.me.name} level={climb.level} owned={world.owned} total={world.total} onOpen={() => go(lastBookHref ?? spreads[0]!.href)} />}
        </div>
      </main>
      <UnitFrame me={world.me} climb={climb} coins={coins} />
      <SystemMenu rank={rank} onSettings={() => toggleWindow("settings")} onLeaderboard={() => toggleWindow("leaderboard")} settingsOpen={hudWindow === "settings"} leaderboardOpen={hudWindow === "leaderboard"} />
      <QuestTracker quests={world.quests} onProgress={actions.progressQuest} onOpenReward={openReward} onOpenLog={() => toggleWindow("quests")} />
      <Hotbar slots={slots} pressed={pressed} />
      <XpBar climb={climb} />
      {hudWindow === "quests" && <QuestLog quests={world.quests} onClose={closeWindow} onProgress={actions.progressQuest} onFinish={actions.finishQuest} onOpenReward={openReward} />}
      {hudWindow === "activity" && <ActivityWindow received={world.received} given={world.given} onClose={closeWindow} />}
      {hudWindow === "leaderboard" && <LeaderboardWindow board={world.board} onClose={closeWindow} />}
      {hudWindow === "settings" && <SettingsWindow page={todaysPage} onClose={closeWindow} />}
      {questBanner !== null && <QuestCompleteBanner key={questBanner.id} name={questBanner.name} />}
      {levelBanner !== null && <LevelUpBanner key={levelBanner} level={levelBanner} />}
      {world.lastDrop !== null && <LootReveal key={`${world.lastDrop.hoggie}:${world.lastDrop.copy}`} drop={world.lastDrop} onCollect={actions.forgetLastDrop} />}
    </div>
  );
}

function Meadow() {
  return (
    <div className="v1-meadow" aria-hidden="true">
      <span className="v1-hill v1-hill-back" />
      <span className="v1-hill v1-hill-front" />
      <HedgehogExplorer size={170} className="v1-meadow-explorer" />
    </div>
  );
}

function useLagging<T>(value: T, ms: number) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return shown;
}

function useFlash(): [string | null, (key: string) => void] {
  const [pressed, setPressed] = useState<string | null>(null);
  useEffect(() => {
    if (pressed === null) return;
    const timer = window.setTimeout(() => setPressed(null), 180);
    return () => window.clearTimeout(timer);
  }, [pressed]);
  return [pressed, setPressed];
}

type Completion = { id: string; name: string };

function useQuestCompletions(quests: Quest[]) {
  const before = useRef(new Map(quests.map((quest) => [quest.id, quest.state])));
  const [banner, setBanner] = useState<Completion | null>(null);
  useEffect(() => {
    const done = quests.find((quest) => quest.state === "finished" && before.current.get(quest.id) === "active");
    before.current = new Map(quests.map((quest) => [quest.id, quest.state]));
    if (done !== undefined) setBanner({ id: done.id, name: questName(done) });
  }, [quests]);
  useEffect(() => {
    if (banner === null) return;
    const timer = window.setTimeout(() => setBanner(null), 2600);
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
    const timer = window.setTimeout(() => setBanner(null), 2600);
    return () => window.clearTimeout(timer);
  }, [banner]);
  return banner;
}

const phoneWidth = 760;

function scaleFor(width: number, height: number) {
  if (width < phoneWidth) return 1;
  return Math.min(1, (width - 540) / 900, (height - 330) / 570);
}

function useBookScale() {
  const [scale, setScale] = useState(() => scaleFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const resize = () => setScale(scaleFor(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return scale;
}
