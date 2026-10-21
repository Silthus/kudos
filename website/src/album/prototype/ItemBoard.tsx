// PROTOTYPE (personal#97, round 3): the item board. Every unseen reward lies face down. A click sets the board aside and shows the item's real album page at once, turns the item over, scrolls to its slot and drops it in, then rests before the board returns. A second click skips to the end. Never merge to main.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useNavigate } from "../../AppLink";
import { hoggiePictureOf } from "../../crates/Hoggie";
import { TeamCrest } from "../../crates/TeamCrest";
import { albumFixtures } from "../albumFixtures";
import { Sparkles } from "../PackCards";
import { rarityWordOf } from "../opening";
import { boardItems, land, landedItems, pay, useProgress, type BoardItem } from "./itemBoardItems";
import { staysStill, useBoardParams } from "./itemBoardParams";
import "../opening.css";
import "./itemBoard.css";

type Point = { x: number; y: number };

type Stage = "aside" | "turn" | "hold" | "land" | "back";

type Turning = { item: BoardItem; stage: Stage; from: DOMRect; spot: Point; size: number; burst: boolean; caption: boolean; switching: boolean };

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
  const [turning, setTurning] = useState<Turning | null>(null);
  const [chip, setChip] = useState<Chip | null>(null);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [said, setSaid] = useState("");
  const flyer = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLSpanElement>(null);
  const chipBox = useRef<HTMLSpanElement>(null);
  const clock = useRef<Clock | null>(null);
  const allDone = waiting.length === 0;
  const [touched, setTouched] = useState(false);
  const touch = () => setTouched(true);
  useNewBadges(landed);
  useSkipOnASecondClick(turning !== null, clock);

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

  const goTo = (item: BoardItem) => {
    if (currentPage() === item.page) return;
    navigate(item.page);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const turnOver = async (item: BoardItem, button: HTMLButtonElement) => {
    if (turning !== null) return;
    setTouched(true);
    if (staysStill(board)) {
      goTo(item);
      land(item.id);
      pay(item.id);
      setSaid(stillWordsOf(item));
      await frames(3);
      document.querySelector<HTMLElement>(item.target)?.scrollIntoView({ block: "center", behavior: "instant" });
      return;
    }
    setSaid("");
    const from = button.getBoundingClientRect();
    setTurning({ item, stage: "aside", from, spot: centreOf(from), size: from.width, burst: false, caption: false, switching: false });
    await frames(2);
    clock.current = makeClock(board.speed);
    await play(clock.current, { item, from, goTo }, { flyer, flip, disc, chipBox }, { setTurning, setChip, setTouches });
    clock.current = null;
    setTurning(null);
  };

  if (!open) return allDone ? null : <ItemsWaitButton count={waiting.length} onShow={onShow} />;
  return (
    <>
      <div className="ib-ground" data-stage={turning?.stage ?? "idle"} data-switching={turning?.switching ? "" : undefined} style={{ "--ib-speed": board.speed } as CSSProperties}>
        <div className="ib-scrim" />
        <section className="ib-board" role="dialog" aria-modal="true" aria-label="Your items">
          <header className="ib-head">
            <h2 className="ib-title">{allDone ? "Everything is in your album" : waiting.length === 1 ? "1 item waits" : `${waiting.length} items wait`}</h2>
          </header>
          <ul className="ib-items" data-touched={touched ? "" : undefined}>
            {boardItems.map((item, index) => (
              <li key={item.id} className="ib-slot" data-gone={landed.has(item.id) ? "" : undefined} data-first={item.id === waiting[0]?.id ? "" : undefined} style={layOf(index)}>
                <button type="button" className="ib-item" data-active={turning?.item.id === item.id ? "" : undefined} aria-label="A face-down item. Turn it over" disabled={landed.has(item.id)} onPointerEnter={touch} onFocus={touch} onClick={(event) => void turnOver(item, event.currentTarget)}>
                  <ItemBack />
                </button>
                {item.id === waiting[0]?.id && !touched && <span className="ib-pointer" aria-hidden="true" />}
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
        {turning !== null && <Flyer turning={turning} flyer={flyer} flip={flip} disc={disc} />}
        {turning?.burst && <Burst turning={turning} />}
        {turning?.caption && <Caption turning={turning} />}
        {turning !== null && turning.stage !== "back" && <p className="ib-skip">Click to skip</p>}
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

type Clock = {
  animate: (element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions & { duration: number }) => Promise<unknown>;
  sleep: (time: number) => Promise<void>;
  tween: (time: number, step: (progress: number) => void) => Promise<void>;
  skip: () => void;
};

function makeClock(speed: number): Clock {
  let skipped = false;
  const running = new Set<Animation>();
  const waiting = new Set<() => void>();
  const scaled = (time: number) => (skipped ? 1 : time / speed);
  return {
    animate(element, keyframes, options) {
      const animation = element.animate(keyframes, { ...options, duration: scaled(options.duration), fill: "forwards" });
      running.add(animation);
      if (skipped) animation.finish();
      return animation.finished.catch(() => undefined).finally(() => running.delete(animation));
    },
    sleep(time) {
      if (skipped) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => {
          window.clearTimeout(timer);
          waiting.delete(done);
          resolve();
        };
        const timer = window.setTimeout(done, scaled(time));
        waiting.add(done);
      });
    },
    tween(time, step) {
      const total = scaled(time);
      const start = performance.now();
      return new Promise((resolve) => {
        const done = () => {
          waiting.delete(done);
          step(1);
          resolve();
        };
        waiting.add(done);
        const tick = () => {
          if (!waiting.has(done)) return;
          const progress = Math.min(1, (performance.now() - start) / total);
          step(easeInOut(progress));
          if (progress < 1) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
    },
    skip() {
      skipped = true;
      running.forEach((animation) => animation.finish());
      [...waiting].forEach((done) => done());
    },
  };
}

function useSkipOnASecondClick(playing: boolean, clock: RefObject<Clock | null>) {
  useEffect(() => {
    if (!playing) return;
    const skip = () => clock.current?.skip();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Escape") skip();
    };
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [playing, clock]);
}

type Boxes = { flyer: RefObject<HTMLDivElement | null>; flip: RefObject<HTMLDivElement | null>; disc: RefObject<HTMLSpanElement | null>; chipBox: RefObject<HTMLSpanElement | null> };

type Setters = { setTurning: (change: (turning: Turning | null) => Turning | null) => void; setChip: (chip: Chip | null) => void; setTouches: (change: (touches: Touch[]) => Touch[]) => void };

type Play = { item: BoardItem; from: DOMRect; goTo: (item: BoardItem) => void };

async function play(clock: Clock, { item, from, goTo }: Play, boxes: Boxes, set: Setters) {
  const flyer = boxes.flyer.current!;
  const flip = boxes.flip.current!;
  const origin = centreOf(from);
  const stage = (next: Stage, more: Partial<Turning> = {}) => set.setTurning((turning) => (turning === null ? null : { ...turning, stage: next, ...more }));
  const at = (point: Point, scale: number) => `translate(${point.x - origin.x}px, ${point.y - origin.y}px) scale(${scale})`;
  let here = origin;
  let scale = 1;
  const moveTo = async (point: Point, nextScale: number, time: number, easing: string, lift = 0) => {
    const middle = { x: (here.x + point.x) / 2, y: Math.min(here.y, point.y) - lift };
    const keyframes = lift === 0 ? [{ transform: at(here, scale) }, { transform: at(point, nextScale) }] : [{ transform: at(here, scale) }, { transform: at(middle, (scale + nextScale) / 2 + 0.1), offset: 0.45 }, { transform: at(point, nextScale) }];
    await clock.animate(flyer, keyframes, { duration: time, easing });
    here = point;
    scale = nextScale;
  };

  const middle = { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
  const big = Math.min(1.8, (Math.min(window.innerWidth, window.innerHeight) * 0.3) / from.width);
  const lifting = moveTo(middle, big, 560, "cubic-bezier(0.3, 0.8, 0.3, 1)", 40);
  if (currentPage() !== item.page) {
    stage("aside", { switching: true });
    await clock.sleep(200);
    goTo(item);
    await frames(2);
    stage("aside", { switching: false });
  }
  await lifting;

  stage("turn", { spot: here, size: from.width * scale });
  const turning = clock.animate(flip, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(205deg)", offset: 0.72 }, { transform: "rotateY(180deg)" }], { duration: 720, easing: "cubic-bezier(0.45, 0, 0.2, 1)" });
  await clock.sleep(330);
  stage("turn", { burst: true });
  await turning;

  stage("hold", { caption: true });
  const paying = item.xp > 0 ? flyXp(clock, item, here, from.width * scale, boxes, set) : Promise.resolve();
  await clock.sleep(450);
  const slot = await slotOf(item);
  await Promise.all([clock.sleep(300), scrollToSlot(clock, slot)]);
  await paying;

  const target = slot?.getBoundingClientRect() ?? new DOMRect(middle.x - 40, middle.y - 40, 80, 80);
  const goal = centreOf(target);
  const above = { x: goal.x, y: Math.max(140, goal.y - target.height * 0.5 - 60) };
  stage("land", { burst: false, caption: false });
  await moveTo(above, 1.25, 420, "cubic-bezier(0.3, 0.8, 0.3, 1)", 30);
  const fitting = fitToSlot(clock, boxes.disc.current, item, slot);
  await moveTo(goal, Math.max(0.2, Math.min(target.width, target.height) / from.width), 260, "cubic-bezier(0.6, 0, 0.9, 0.6)");
  await fitting;

  land(item.id);
  set.setTouches((touches) => [...touches, { key: Date.now(), rect: target, colour: colourOf(item) }]);
  slot?.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
  window.setTimeout(() => set.setTouches((touches) => touches.slice(1)), 900);
  await clock.sleep(800);
  stage("back");
  await clock.sleep(420);
}

async function slotOf(item: BoardItem): Promise<HTMLElement | null> {
  for (let tries = 0; tries < 20; tries += 1) {
    const found = document.querySelector<HTMLElement>(item.target);
    if (found !== null) return found;
    await frames(2);
  }
  return null;
}

function scrollToSlot(clock: Clock, slot: HTMLElement | null) {
  if (slot === null) return Promise.resolve();
  const from = window.scrollY;
  const rect = slot.getBoundingClientRect();
  const wanted = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, from + rect.top + rect.height / 2 - window.innerHeight * 0.6));
  if (Math.abs(wanted - from) < 4) return Promise.resolve();
  return clock.tween(Math.min(1300, 500 + Math.abs(wanted - from) * 0.35), (progress) => window.scrollTo({ top: from + (wanted - from) * progress, behavior: "instant" }));
}

function fitToSlot(clock: Clock, disc: HTMLSpanElement | null, item: BoardItem, slot: HTMLElement | null) {
  if (disc === null) return Promise.resolve();
  if (item.kind === "sticker") {
    const radius = slot === null ? "50%" : getComputedStyle(slot).borderRadius;
    const pixels = parseFloat(radius);
    const share = slot === null || Number.isNaN(pixels) ? "50%" : `${(pixels / slot.getBoundingClientRect().width) * 100}%`;
    return clock.animate(disc, [{ borderRadius: "50%" }, { borderRadius: share }], { duration: 260, easing: "ease-in" });
  }
  return clock.animate(disc, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-in" });
}

async function flyXp(clock: Clock, item: BoardItem, here: Point, size: number, boxes: Boxes, set: Setters) {
  await clock.sleep(200);
  const from = { x: here.x + size * 0.32, y: here.y - size * 0.42 };
  set.setChip({ key: Date.now(), from, xp: item.xp });
  await frames(2);
  const chip = boxes.chipBox.current;
  const bar = document.querySelector<HTMLElement>(".al-xp-track")?.getBoundingClientRect();
  if (chip === null || bar === undefined) return pay(item.id);
  const to = { x: bar.left + bar.width * 0.8, y: bar.top + bar.height / 2 };
  const middle = { x: (from.x + to.x) / 2 + 40, y: Math.min(from.y, to.y) - 60 };
  await clock.animate(
    chip,
    [
      { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.15)", opacity: 1, offset: 0.18 },
      { transform: `translate(calc(-50% + ${middle.x - from.x}px), calc(-50% + ${middle.y - from.y}px)) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.5)`, opacity: 0.4 },
    ],
    { duration: 820, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
  );
  set.setChip(null);
  pay(item.id);
  document.querySelector<HTMLElement>(".al-xp")?.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
}

function useNewBadges(landed: ReadonlySet<string>) {
  useEffect(() => {
    const rules = landedItems(landed).map(({ badge }) => `${badge} { position: relative; } ${badge}::after { ${newBadgeStyle} }`);
    const style = document.createElement("style");
    style.dataset.ibBadges = "";
    style.textContent = rules.join("\n");
    document.head.append(style);
    return () => style.remove();
  }, [landed]);
}

const newBadgeStyle = `content: "New"; position: absolute; top: -0.5rem; right: -0.5rem; z-index: 2; padding: 0.125rem 0.5rem; border: 2px solid var(--card); border-radius: 999px; background: var(--al-accent); color: white; font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.02em; line-height: 1.2; pointer-events: none; animation: ib-badge 420ms cubic-bezier(0.2, 0.9, 0.3, 1.4) both;`;

function currentPage() {
  return window.location.pathname + window.location.hash;
}

function Flyer({ turning, flyer, flip, disc }: { turning: Turning; flyer: RefObject<HTMLDivElement | null>; flip: RefObject<HTMLDivElement | null>; disc: RefObject<HTMLSpanElement | null> }) {
  const { from, item } = turning;
  return (
    <div ref={flyer} className="ib-flyer" style={{ left: from.left, top: from.top, width: from.width, height: from.height, "--burst": colourOf(item) } as CSSProperties}>
      <div ref={flip} className="ib-flip">
        <div className="ib-face">
          <ItemBack />
        </div>
        <div className="ib-face ib-front-face">
          <ItemFront item={item} disc={disc} />
        </div>
      </div>
    </div>
  );
}

function Burst({ turning }: { turning: Turning }) {
  const { spot, size, item } = turning;
  const rare = item.kind === "emoji" || (item.kind === "hoggie" && (item.rarity === "epic" || item.rarity === "legendary" || item.rarity === "rare"));
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

function ItemBack() {
  return (
    <span className="ib-back">
      <span className="ib-q">?</span>
    </span>
  );
}

function ItemFront({ item, disc }: { item: BoardItem; disc: RefObject<HTMLSpanElement | null> }) {
  return (
    <span className="ib-front" data-kind={item.kind}>
      <span ref={disc} className="ib-disc" />
      <FrontArt item={item} />
    </span>
  );
}

function FrontArt({ item }: { item: BoardItem }) {
  if (item.kind === "sticker") {
    const team = albumFixtures.trayed.teams.find(({ team: one }) => one === item.team);
    return (
      <>
        <span className="ib-initials">{item.initials}</span>
        {team !== undefined && (
          <span className="ib-crest">
            <TeamCrest art={team.art} size={28} name={team.name} />
          </span>
        )}
      </>
    );
  }
  if (item.kind === "hoggie") {
    const picture = hoggiePictureOf({ kind: "hoggie", slug: item.hoggie });
    return picture === undefined ? null : <img src={picture} alt="" draggable={false} />;
  }
  return <img src={item.picture} alt="" draggable={false} />;
}

function whatWordsOf(item: BoardItem) {
  if (item.kind === "sticker") {
    const team = albumFixtures.trayed.teams.find(({ team: one }) => one === item.team);
    return team === undefined ? "New in your album" : `New in your album · ${team.name} ${Math.min(team.total, team.held + 1)}/${team.total}`;
  }
  if (item.kind === "hoggie") return `${rarityWordOf(item.rarity)} hoggie${item.isNew ? " · New" : ""}`;
  return item.what;
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
  const nudges = [10, -18, 22, -6, 16, -20, 6, -14, 12];
  const sizes = [1, 0.92, 1.04, 0.95, 1, 1.06, 0.9, 1, 0.94];
  return { "--tilt": `${tilts[index % tilts.length]}deg`, "--nudge": `${nudges[index % nudges.length]}px`, "--size": sizes[index % sizes.length] } as CSSProperties;
}

function centreOf(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function easeInOut(progress: number) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

function frames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  });
}
