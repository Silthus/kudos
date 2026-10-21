// PROTOTYPE (personal#97): the item board. Every unseen reward lies face down; a click turns it over and lands it on its real album page behind the board. Three sequences switch in the prototype bar. Never merge to main.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useNavigate } from "../../AppLink";
import { hoggiePictureOf } from "../../crates/Hoggie";
import { TeamCrest } from "../../crates/TeamCrest";
import { albumFixtures } from "../albumFixtures";
import { Sparkles } from "../PackCards";
import { rarityWordOf } from "../opening";
import { boardItems, land, pay, useProgress, type BoardItem } from "./itemBoardItems";
import { staysStill, useBoardParams, type BoardParams } from "./itemBoardParams";
import "../opening.css";
import "./itemBoard.css";

type Point = { x: number; y: number };

type Stage = "lift" | "aside" | "turn" | "hold" | "land" | "back";

type Turning = { item: BoardItem; stage: Stage; from: DOMRect; spot: Point; size: number; burst: boolean; caption: boolean };

type Chip = { key: number; from: Point; xp: number };

type Touch = { key: number; rect: DOMRect; colour: string };

export function useItemBoard() {
  const [open, setOpen] = useState(true);
  return { open, show: useCallback(() => setOpen(true), []), hide: useCallback(() => setOpen(false), []) };
}

export function ItemBoard({ open, onShow, onHide }: { open: boolean; onShow: () => void; onHide: () => void }) {
  const { landed } = useProgress();
  const waiting = boardItems.filter(({ id }) => !landed.has(id));
  const board = useBoardParams();
  const navigate = useNavigate();
  const [peek, setPeek] = useState<BoardItem | null>(null);
  const [turning, setTurning] = useState<Turning | null>(null);
  const [chip, setChip] = useState<Chip | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [said, setSaid] = useState("");
  const flyer = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const chipBox = useRef<HTMLSpanElement>(null);
  const shownPage = useRef("");
  const dwell = useRef<number | undefined>(undefined);
  const allDone = waiting.length === 0;

  const showPageOf = useCallback(
    (item: BoardItem) => {
      if (item.page === "" || shownPage.current === item.page) return;
      shownPage.current = item.page;
      navigate(item.page);
    },
    [navigate],
  );

  const peekAt = (item: BoardItem) => {
    if (turning !== null) return;
    window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => {
      setPeek(item);
      showPageOf(item);
    }, 140);
  };

  const stopPeeking = () => {
    window.clearTimeout(dwell.current);
    setPeek(null);
  };

  useEffect(() => {
    if (!allDone || !open) return;
    const closing = window.setTimeout(onHide, 1600);
    return () => window.clearTimeout(closing);
  }, [allDone, open, onHide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && turning === null) onHide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, turning, onHide]);

  const turnOver = async (item: BoardItem, button: HTMLButtonElement) => {
    if (turning !== null) return;
    window.clearTimeout(dwell.current);
    setPeek(null);
    showPageOf(item);
    if (staysStill(board)) {
      land(item.id);
      pay(item.id);
      setSaid(stillWordsOf(item));
      return;
    }
    setSaid("");
    const from = button.getBoundingClientRect();
    const start: Turning = { item, stage: board.variant === "page-first" ? "aside" : board.variant === "spotlight" ? "lift" : "turn", from, spot: centreOf(from), size: from.width, burst: false, caption: false };
    setTurning(start);
    await frames(3);
    await play(board, start, { flyer, flip, chipBox }, { setTurning, setChip, setTouches });
    setTurning(null);
  };

  if (!open) return allDone ? null : <ItemsWaitButton count={waiting.length} onShow={onShow} />;
  const dimmed = turning !== null && (board.variant !== "in-place" || turning.stage === "land" || turning.stage === "back");
  return (
    <>
      <div className="ib-ground" data-stage={turning?.stage ?? "idle"} data-variant={board.variant} data-peek={peek !== null ? "" : undefined}>
        <div className="ib-scrim" />
        <section className="ib-board" role="dialog" aria-modal="true" aria-label="Your items">
          <header className="ib-head">
            <h2 className="ib-title">{allDone ? "Everything is in your album" : waiting.length === 1 ? "1 item waits" : `${waiting.length} items wait`}</h2>
            <p className="ib-sub">{allDone ? "Thank someone to earn the next one" : peek !== null ? `Belongs ${belongsWordsOf(peek)}` : "Turn one over"}</p>
          </header>
          <ul className="ib-items" data-dimmed={dimmed ? "" : undefined}>
            {boardItems.map((item, index) => (
              <li key={item.id} className="ib-slot" data-gone={landed.has(item.id) ? "" : undefined} style={layOf(index)}>
                <button
                  type="button"
                  className="ib-item"
                  data-active={turning?.item.id === item.id ? "" : undefined}
                  aria-label={`A face-down item, ${item.source.toLowerCase()}. Turn it over`}
                  disabled={landed.has(item.id)}
                  onPointerEnter={() => peekAt(item)}
                  onPointerLeave={stopPeeking}
                  onFocus={() => peekAt(item)}
                  onBlur={stopPeeking}
                  onClick={(event) => void turnOver(item, event.currentTarget)}
                >
                  <ItemBack />
                </button>
              </li>
            ))}
          </ul>
          <p className="ib-said" role="status">
            {said}
          </p>
          {!allDone && (
            <button type="button" className="ib-later" onClick={onHide} disabled={turning !== null}>
              Later
            </button>
          )}
        </section>
      </div>
      <div className="ib-air" aria-hidden="true">
        {turning !== null && <Flyer turning={turning} flyer={flyer} flip={flip} />}
        {turning?.burst && <Burst turning={turning} />}
        {turning?.caption && <Caption turning={turning} />}
        {chip !== null && (
          <span key={chip.key} ref={chipBox} className="ib-chip" style={{ left: chip.from.x, top: chip.from.y }}>
            +{chip.xp} XP
          </span>
        )}
        {touches.map((touch) => (
          <span key={touch.key} className="ib-touch" style={{ left: touch.rect.left, top: touch.rect.top, width: touch.rect.width, height: touch.rect.height, "--burst": touch.colour } as CSSProperties} />
        ))}
      </div>
    </>
  );
}

type Boxes = { flyer: RefObject<HTMLDivElement | null>; flip: RefObject<HTMLDivElement | null>; chipBox: RefObject<HTMLSpanElement | null> };

type Setters = { setTurning: (change: (turning: Turning | null) => Turning | null) => void; setChip: (chip: Chip | null) => void; setTouches: (change: (touches: Touch[]) => Touch[]) => void };

async function play(board: BoardParams, start: Turning, boxes: Boxes, set: Setters) {
  const ms = (time: number) => time / board.speed;
  const flyer = boxes.flyer.current!;
  const flip = boxes.flip.current!;
  const { item, from } = start;
  const origin = centreOf(from);
  const target = await targetOf(item);
  const goal = centreOf(target);
  const endScale = Math.max(0.2, Math.min(target.width, target.height) / from.width);
  const stage = (next: Stage, more: Partial<Turning> = {}) => set.setTurning((turning) => (turning === null ? null : { ...turning, stage: next, ...more }));
  const at = (point: Point, scale: number) => `translate(${point.x - origin.x}px, ${point.y - origin.y}px) scale(${scale})`;
  let here = origin;
  let scale = 1;

  const moveTo = async (point: Point, nextScale: number, time: number, easing: string, lift = 0) => {
    const middle = { x: (here.x + point.x) / 2, y: Math.min(here.y, point.y) - lift };
    const keyframes = lift === 0 ? [{ transform: at(here, scale) }, { transform: at(point, nextScale) }] : [{ transform: at(here, scale) }, { transform: at(middle, (scale + nextScale) / 2 + 0.15), offset: 0.45 }, { transform: at(point, nextScale) }];
    await flyer.animate(keyframes, { duration: ms(time), easing, fill: "forwards" }).finished;
    here = point;
    scale = nextScale;
  };

  const turn = async () => {
    stage("turn", { spot: here, size: from.width * scale });
    const turning = flip.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(205deg)", offset: 0.72 }, { transform: "rotateY(180deg)" }], { duration: ms(720), easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" });
    await sleep(ms(330));
    stage("turn", { burst: true });
    await turning.finished;
  };

  const hold = async (time: number) => {
    stage("hold", { caption: true });
    const paying = item.xp > 0 ? flyXp(item, here, from.width * scale, ms, boxes, set) : Promise.resolve();
    await Promise.all([sleep(ms(time)), paying]);
  };

  const touchDown = () => {
    land(item.id);
    set.setTouches((touches) => [...touches, { key: Date.now(), rect: target, colour: colourOf(item) }]);
    document.querySelector<HTMLElement>(item.target)?.animate([{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }], { duration: ms(380), easing: "ease-out" });
    window.setTimeout(() => set.setTouches((touches) => touches.slice(1)), ms(900));
  };

  if (board.variant === "spotlight") {
    const middle = { x: window.innerWidth / 2, y: window.innerHeight * 0.44 };
    const big = Math.min(2.6, (Math.min(window.innerWidth, window.innerHeight) * 0.36) / from.width);
    await moveTo(middle, big, 460, "cubic-bezier(0.2, 0.9, 0.3, 1.15)", 30);
    await turn();
    await hold(1100);
    stage("land", { burst: false, caption: false });
    await moveTo(goal, endScale, 720, "cubic-bezier(0.55, 0, 0.25, 1)", 90);
  } else if (board.variant === "in-place") {
    await moveTo({ x: origin.x, y: origin.y - 12 }, 1.45, 220, "cubic-bezier(0.2, 0.9, 0.3, 1.2)");
    await turn();
    await hold(850);
    stage("land", { burst: false, caption: false });
    await moveTo(goal, endScale, 680, "cubic-bezier(0.55, 0, 0.25, 1)", 110);
  } else {
    const above = { x: goal.x, y: Math.max(window.innerHeight * 0.3, goal.y - target.height * 0.5 - 70) };
    await sleep(ms(260));
    await moveTo(above, 1.5, 640, "cubic-bezier(0.3, 0.8, 0.3, 1)", 60);
    await turn();
    await hold(800);
    stage("land", { burst: false, caption: false });
    await moveTo(goal, endScale, 300, "cubic-bezier(0.6, 0, 0.9, 0.6)");
  }
  touchDown();
  stage("back");
  await sleep(ms(380));
}

async function flyXp(item: BoardItem, here: Point, size: number, ms: (time: number) => number, boxes: Boxes, set: Setters) {
  await sleep(ms(260));
  const from = { x: here.x + size * 0.32, y: here.y - size * 0.42 };
  set.setChip({ key: Date.now(), from, xp: item.xp });
  await frames(2);
  const chip = boxes.chipBox.current;
  const bar = document.querySelector<HTMLElement>(".al-xp-track")?.getBoundingClientRect();
  if (chip === null || bar === undefined) return pay(item.id);
  const to = { x: bar.left + bar.width * 0.8, y: bar.top + bar.height / 2 };
  const middle = { x: (from.x + to.x) / 2 + 40, y: Math.min(from.y, to.y) - 60 };
  await chip.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.15)", opacity: 1, offset: 0.18 },
      { transform: `translate(calc(-50% + ${middle.x - from.x}px), calc(-50% + ${middle.y - from.y}px)) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.5)`, opacity: 0.4 },
    ],
    { duration: ms(820), easing: "cubic-bezier(0.4, 0, 0.3, 1)", fill: "forwards" },
  ).finished;
  set.setChip(null);
  pay(item.id);
  document.querySelector<HTMLElement>(".al-xp")?.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: ms(420), easing: "ease-out" });
}

async function targetOf(item: BoardItem): Promise<DOMRect> {
  for (let tries = 0; tries < 20; tries += 1) {
    const found = document.querySelector<HTMLElement>(item.target);
    if (found !== null) {
      if (!item.target.startsWith(".al-emojis")) found.scrollIntoView({ block: "center", behavior: "instant" });
      await frames(2);
      return found.getBoundingClientRect();
    }
    await frames(2);
  }
  const fallback = document.querySelector("main h1")?.getBoundingClientRect();
  return fallback ?? new DOMRect(window.innerWidth / 2 - 40, 120, 80, 80);
}

function Flyer({ turning, flyer, flip }: { turning: Turning; flyer: RefObject<HTMLDivElement | null>; flip: RefObject<HTMLDivElement | null> }) {
  const { from, item } = turning;
  return (
    <div ref={flyer} className="ib-flyer" style={{ left: from.left, top: from.top, width: from.width, height: from.height, "--burst": colourOf(item) } as CSSProperties}>
      <div ref={flip} className="ib-flip">
        <div className="ib-face">
          <ItemBack />
        </div>
        <div className="ib-face ib-front-face">
          <ItemFront item={item} />
        </div>
      </div>
    </div>
  );
}

function Burst({ turning }: { turning: Turning }) {
  const { spot, size, item } = turning;
  const rare = item.kind === "hoggie" && (item.rarity === "epic" || item.rarity === "legendary" || item.rarity === "rare");
  return (
    <span className="ib-burst" data-rare={rare ? "" : undefined} style={{ left: spot.x, top: spot.y, width: size, height: size, "--burst": colourOf(item), "--rarity-color": colourOf(item) } as CSSProperties}>
      <span className="ib-rays" />
      <span className="ib-flash" />
      <Sparkles count={rare ? 18 : 10} seed={item.id.length * 7} />
    </span>
  );
}

function Caption({ turning }: { turning: Turning }) {
  const { spot, size, item } = turning;
  return (
    <span className="ib-caption" style={{ left: spot.x, top: spot.y + size / 2 + 14, "--burst": colourOf(item) } as CSSProperties}>
      <strong className="ib-caption-name">{item.name}</strong>
      <span className="ib-caption-what">{whatWordsOf(item)}</span>
      <span className="ib-caption-source">{item.source}</span>
    </span>
  );
}

function ItemsWaitButton({ count, onShow }: { count: number; onShow: () => void }) {
  return (
    <button type="button" className="ib-wait" onClick={onShow}>
      <span className="ib-wait-disc" aria-hidden="true">
        ?
      </span>
      {count === 1 ? "1 item waits" : `${count} items wait`}
    </button>
  );
}

export function ItemBack() {
  return (
    <span className="ib-back">
      <span className="ib-q">?</span>
    </span>
  );
}

function ItemFront({ item }: { item: BoardItem }) {
  if (item.kind === "sticker") {
    const team = albumFixtures.trayed.teams.find(({ team: one }) => one === item.team);
    return (
      <span className="ib-front" data-kind="sticker">
        <span className="ib-initials">{item.initials}</span>
        {team !== undefined && (
          <span className="ib-crest">
            <TeamCrest art={team.art} size={28} name={team.name} />
          </span>
        )}
      </span>
    );
  }
  if (item.kind === "hoggie") {
    const picture = hoggiePictureOf({ kind: "hoggie", slug: item.hoggie });
    return (
      <span className="ib-front" data-kind="hoggie" style={{ "--burst": colourOf(item) } as CSSProperties}>
        {picture !== undefined && <img src={picture} alt="" draggable={false} />}
      </span>
    );
  }
  return (
    <span className="ib-front" data-kind="emoji">
      <img src={item.picture} alt="" draggable={false} />
    </span>
  );
}

function whatWordsOf(item: BoardItem) {
  if (item.kind === "sticker") {
    const team = albumFixtures.trayed.teams.find(({ team: one }) => one === item.team);
    return team === undefined ? "New in your album" : `New in your album · ${team.name} ${Math.min(team.total, team.held + 1)}/${team.total}`;
  }
  if (item.kind === "hoggie") return `${rarityWordOf(item.rarity)} hoggie${item.isNew ? " · New" : ""}`;
  return "New emoji, ready in Slack";
}

function belongsWordsOf(item: BoardItem) {
  if (item.kind === "sticker") return "on a team page";
  if (item.kind === "hoggie") return "with your hoggies";
  return "with your emojis";
}

function stillWordsOf(item: BoardItem) {
  const xp = item.xp > 0 ? ` +${item.xp} XP.` : "";
  return `${item.name}: ${whatWordsOf(item)}.${xp}`;
}

function colourOf(item: BoardItem) {
  if (item.kind === "hoggie") return `var(--rarity-${item.rarity})`;
  if (item.kind === "emoji") return "var(--al-gold, #d4a017)";
  return "var(--al-accent)";
}

function layOf(index: number): CSSProperties {
  const tilts = [-7, 4, -2, 6, -5, 3, -4, 7, -3];
  const nudges = [4, -6, 8, -2, 6, -8, 2, -4, 5];
  return { "--tilt": `${tilts[index % tilts.length]}deg`, "--nudge": `${nudges[index % nudges.length]}px` } as CSSProperties;
}

function centreOf(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function sleep(time: number) {
  return new Promise((resolve) => window.setTimeout(resolve, time));
}

function frames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  });
}
