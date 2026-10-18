import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CrateRewardFlight } from "../../crates/CrateRewardFlight";
import type { Drop } from "../../crates/drops";
import type { Origin } from "../../crates/RewardFlight";
import { climbRewardOf, type RewardKind } from "../../crates/rewards";
import { prefersReducedMotion } from "../../reducedMotion";
import type { MemberProfile } from "../../shell";
import { HoggieCoin } from "../HoggieCoin";
import { appears, flyBetween, markFor, scrollIntoViewIfNeeded, wait } from "./flight";
import { Chip } from "./PackChip";
import { chipsOf, type OpenedPack } from "./packs";

export const bookFlipsForMs = 200;

export const tileSettlesForMs = 400;

export const packFliesForMs = 850;

export const tileGlowsForMs = 1500;

export const landingPauseMs = 600;

const tileLooksEveryMs = 50;

type Landing = { pack: OpenedPack; chipsFly: boolean };

type PackLandingProps = { opened: OpenedPack[]; shown: MemberProfile; onRewardLanded: (crate: string, kind: RewardKind) => void; onDone: () => void };

export function PackLanding({ opened, shown, onRewardLanded, onDone }: PackLandingProps) {
  const [current, setCurrent] = useState<Landing>();
  const [flown, setFlown] = useState<RewardKind[]>([]);
  const ghost = useRef<HTMLSpanElement>(null);
  const chipGhosts = useRef(new Map<string, HTMLSpanElement>());
  const chipsLanded = useRef<() => void>(undefined);
  const latest = useRef({ onRewardLanded, onDone });
  latest.current = { onRewardLanded, onDone };
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const stillWanted = () => !cancelled;
      for (const pack of opened) {
        if (cancelled) return;
        setFlown([]);
        setCurrent({ pack, chipsFly: false });
        if (pack.drop !== null) await land(pack.drop, ghost, stillWanted);
        if (cancelled) return;
        if (chipsOf(pack.applied).length > 0) {
          const flown = new Promise<void>((resolve) => (chipsLanded.current = resolve));
          setCurrent({ pack, chipsFly: true });
          await flown;
          if (cancelled) return;
        }
        setCurrent(undefined);
        await wait(landingPauseMs);
      }
      if (!cancelled) latest.current.onDone();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [opened]);
  const crate = current?.pack.crate;
  const originOf = useCallback((kind: RewardKind): Origin | undefined => chipGhosts.current.get(kind === "skillPoints" ? "xp" : kind)?.getBoundingClientRect(), []);
  const taken = useCallback((kind: RewardKind) => setFlown((before) => (before.includes(kind) ? before : [...before, kind])), []);
  const rewardLanded = useCallback((kind: RewardKind) => crate !== undefined && latest.current.onRewardLanded(crate, kind), [crate]);
  const chipsDone = useCallback(() => chipsLanded.current?.(), []);
  if (current === undefined) return null;
  const { pack, chipsFly } = current;
  const chips = chipsOf(pack.applied);
  const coin = pack.drop !== null && (
    <span ref={ghost} className="inline-flex drop-shadow-2xl">
      <HoggieCoin art={pack.drop.art} rarity={pack.drop.rarity} size={128} />
    </span>
  );
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[55] grid place-items-center" aria-hidden="true">
      {chips.length === 0 ? (
        coin
      ) : (
        <div className="flex flex-col items-center gap-3">
          {coin}
          <span className="pk-chips">
            {chips.map((chip) => (
              <Chip key={chip.kind} chip={chip} flown={flown.includes(chip.kind)} chipRef={(element) => (element === null ? chipGhosts.current.delete(chip.kind) : chipGhosts.current.set(chip.kind, element))} />
            ))}
          </span>
        </div>
      )}
      {chipsFly && pack.applied !== null && <CrateRewardFlight key={pack.crate} reward={climbRewardOf(pack.applied)} shown={shown} landAtOnce={false} originOf={originOf} onRewardTaken={taken} onRewardLanded={rewardLanded} onLanded={chipsDone} />}
    </div>,
    document.body,
  );
}

async function land(drop: Drop, ghost: RefObject<HTMLSpanElement | null>, stillWanted: () => boolean) {
  flipTheBookTo(drop.rarity);
  await wait(bookFlipsForMs);
  const tile = await appears(`[data-hoggie="${drop.hoggie}"]`, tileSettlesForMs, tileLooksEveryMs, stillWanted);
  if (!stillWanted()) return;
  if (tile !== null) scrollIntoViewIfNeeded(tile);
  const target = tile?.querySelector<HTMLElement>("[data-coin]") ?? tile ?? theBookEntry();
  if (ghost.current !== null && target !== null && !prefersReducedMotion()) await flyBetween(ghost.current, target.getBoundingClientRect(), packFliesForMs);
  if (tile !== null && stillWanted()) markFor(tile, "data-landed", tileGlowsForMs);
}

function theBookEntry() {
  return document.querySelector<HTMLElement>('nav a[href="/book"]') ?? document.querySelector<HTMLElement>("[data-crate-store]");
}

function flipTheBookTo(rarity: Drop["rarity"]) {
  if (document.querySelector("[data-spread]") === null) return;
  const hash = `#hoggies/${rarity}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}
