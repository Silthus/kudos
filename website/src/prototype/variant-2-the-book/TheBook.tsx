// PROTOTYPE (#625): variant 2, the whole site as one book on a table: the cover is your profile, ribbons are the chapters. Never merge to main.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "../../AppLink";
import type { VariantProps } from "../PrototypeStage";
import { keepingTheVariant } from "../variants";
import { useWorld, type Drop, type Pack, type Quest } from "../world";
import { BoardBand, Cover, type CoverMotion } from "./Cover";
import { DeskContext, type Desk } from "./desk";
import { durationOf, OpenSpread, type Turn } from "./Leaves";
import { PackBookmarks, QuestNotes, Ribbons } from "./Margins";
import { PackReveal, QuestStamp } from "./Moments";
import { spreadIndexAt, spreadOfHoggie, spreadsOf } from "./spreads";
import "./book.css";

const coverMs = 720;

const stuckMs = 2600;

const bookWidth = 1128;

const bookHeight = 726;

const narrowBelow = 760;

function pathOf(address: string) {
  return address.split("#")[0]!;
}

function hashOf(address: string) {
  const at = address.indexOf("#");
  return at < 0 ? "" : address.slice(at);
}

function useTableFit() {
  const measure = () => ({ narrow: window.innerWidth < narrowBelow, scale: Math.min(1, (window.innerWidth - 24) / (bookWidth + 290), (window.innerHeight - 150) / (bookHeight + 20)) });
  const [fit, setFit] = useState(measure);
  useEffect(() => {
    const refit = () => setFit(measure());
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, []);
  return fit;
}

function useCalmMotion(narrow: boolean) {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const follow = () => setReduced(query.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return reduced || narrow;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function TheBook({ route, todaysPage }: VariantProps) {
  const { world, actions } = useWorld();
  const navigate = useNavigate();
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const spreads = useMemo(() => spreadsOf(world), [world]);
  const { narrow, scale } = useTableFit();
  const calm = useCalmMotion(narrow);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [coverMotion, setCoverMotion] = useState<CoverMotion | null>(null);
  const [revealing, setRevealing] = useState<Pack | null>(null);
  const [celebrating, setCelebrating] = useState<Quest | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [stuck, setStuck] = useState<string | null>(null);
  const busy = useRef(false);

  const open = route.page !== "home";
  const at = open ? spreadIndexAt(spreads, window.location.pathname, window.location.hash) : 0;
  const bookState: CoverMotion | "open" = coverMotion ?? (open ? "open" : "closed");

  const settle = useCallback(
    (address: string, push: boolean) => {
      if (!push && pathOf(address) === window.location.pathname) {
        window.history.replaceState(null, "", keepingTheVariant(address));
        refresh();
      } else navigate(address);
    },
    [navigate],
  );

  const turnTo = useCallback(
    (index: number, push: boolean, address = spreads[index]!.address) => {
      if (busy.current) return;
      if (index === at || calm) {
        settle(address, push);
        return;
      }
      busy.current = true;
      setTurn({ from: at, to: index });
      window.setTimeout(() => {
        busy.current = false;
        setTurn(null);
        settle(address, push);
      }, durationOf({ from: at, to: index }));
    },
    [at, calm, settle, spreads],
  );

  const go = useCallback((address: string) => turnTo(spreadIndexAt(spreads, pathOf(address), hashOf(address)), true, address), [spreads, turnTo]);

  const moveCover = useCallback(
    (motion: CoverMotion, address: string) => {
      if (busy.current) return;
      if (calm) {
        navigate(address);
        return;
      }
      busy.current = true;
      setCoverMotion(motion);
      window.setTimeout(() => {
        busy.current = false;
        setCoverMotion(null);
        navigate(address);
      }, coverMs);
    },
    [calm, navigate],
  );

  const openBook = useCallback(() => moveCover("opening", "/book"), [moveCover]);
  const closeBook = useCallback(() => moveCover("closing", "/"), [moveCover]);

  const celebrate = useCallback((quest: Quest) => {
    setCelebrating(quest);
    setFresh(quest.id);
  }, []);

  const nudge = useCallback(
    (quest: Quest) => {
      if (quest.progress.done + 1 >= quest.progress.target) celebrate(quest);
      actions.progressQuest(quest.id);
    },
    [actions, celebrate],
  );

  const finish = useCallback(
    (quest: Quest) => {
      celebrate(quest);
      actions.finishQuest(quest.id);
    },
    [actions, celebrate],
  );

  const stickIn = useCallback(
    (drop: Drop) => {
      setRevealing(null);
      actions.forgetLastDrop();
      setStuck(drop.hoggie);
      window.setTimeout(() => setStuck(null), stuckMs + durationOf({ from: 0, to: 5 }));
      const page = spreadOfHoggie(spreads, drop.hoggie);
      if (page >= 0) turnTo(page, true);
    },
    [actions, spreads, turnTo],
  );

  useEffect(() => {
    const read = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || revealing !== null) return;
      if (bookState === "closed" && event.key === "Enter") openBook();
      if (bookState !== "open") return;
      if (event.key === "ArrowRight" && at < spreads.length - 1) turnTo(at + 1, false);
      if (event.key === "ArrowLeft" && at > 0) turnTo(at - 1, false);
    };
    window.addEventListener("keydown", read);
    return () => window.removeEventListener("keydown", read);
  }, [at, bookState, openBook, revealing, spreads.length, turnTo]);

  const desk: Desk = { world, actions, spreads, stuck, settingsPage: route.page === "settings" ? todaysPage : null, go, openPack: (id) => setRevealing(world.packs.find((entry) => entry.id === id) ?? null), nudge, finish };
  const pack = revealing;
  const shownAt = bookState === "closed" || bookState === "opening" ? 0 : at;
  const chapter = spreads[shownAt]!.chapter;

  return (
    <DeskContext.Provider value={desk}>
      <div className="v2-table" data-narrow={narrow}>
        <div className="v2-book" data-state={bookState} data-chapter={chapter} style={{ "--book-scale": narrow ? 1 : scale } as CSSProperties}>
          <div className="v2-board" aria-hidden="true" />
          {bookState === "open" && <Ribbons current={chapter} onChoose={go} />}
          <div className="v2-under" inert={bookState !== "open"}>
            <OpenSpread spreads={spreads} at={shownAt} turn={turn} onTurn={(index) => turnTo(index, false)} />
          </div>
          {bookState === "open" && <BoardBand world={world} onClose={closeBook} />}
          {bookState !== "open" && <Cover world={world} motion={bookState} inside={spreads[shownAt]!.left} onOpen={openBook} />}
          {bookState === "open" && <QuestNotes />}
          {bookState === "open" && <PackBookmarks fresh={fresh} />}
          {pack !== null && <PackReveal key={pack.id} pack={pack} onTear={() => actions.openPack(pack.id)} onStick={stickIn} onClose={() => setRevealing(null)} />}
          {celebrating !== null && <QuestStamp quest={celebrating} onDone={() => setCelebrating(null)} />}
        </div>
      </div>
    </DeskContext.Provider>
  );
}
