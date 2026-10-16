import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CoinGlyph } from "../../skills/glyphs";
import { HoggieCoin } from "../HoggieCoin";
import { centreRect, flyBetween, markFor, rectOf, scrollIntoViewIfNeeded } from "./flight";
import { coinWords, xpWords, type Pack } from "./packs";
import { goTo, nextFrame, wait } from "./prototype";

type BookLandingProps = { opened: Pack[]; onLanded: (pack: Pack) => void; onDone: () => void };

export function BookLanding({ opened, onLanded, onDone }: BookLandingProps) {
  const [current, setCurrent] = useState<Pack | undefined>(opened[0]);
  const coin = useRef<HTMLSpanElement>(null);
  const xp = useRef<HTMLSpanElement>(null);
  const coins = useRef<HTMLSpanElement>(null);
  const latest = useRef({ onLanded, onDone });
  latest.current = { onLanded, onDone };
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const pack of opened) {
        if (cancelled) return;
        setCurrent(pack);
        goTo(`#hoggies/${pack.drop.rarity}`);
        await wait(200);
        await nextFrame();
        const tile = `[data-hoggie="${pack.drop.hoggie}"]`;
        const landed = scrollIntoViewIfNeeded(tile);
        const target = (landed && rectOf(`${tile} [data-coin]`)) || rectOf('[data-chapter="hoggies"]') || centreRect(64);
        if (coin.current !== null) await flyBetween(coin.current, coin.current.getBoundingClientRect(), target, 850, -12);
        latest.current.onLanded(pack);
        markFor(tile, "data-landed", 1500);
        const level = rectOf("header a[aria-describedby]") ?? rectOf("header") ?? centreRect(40);
        const purse = rectOf('header [aria-label$="coins to spend"]') ?? level;
        await Promise.all([xp.current && flyBetween(xp.current, xp.current.getBoundingClientRect(), level, 700, 0), coins.current && flyBetween(coins.current, coins.current.getBoundingClientRect(), purse, 750, 0)]);
        markFor("header", "data-landed", 600);
        await wait(150);
        setCurrent(undefined);
        await nextFrame();
      }
      if (!cancelled) latest.current.onDone();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [opened]);
  if (current === undefined) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <span ref={coin} className="inline-flex drop-shadow-2xl">
          <HoggieCoin art={current.drop.art} rarity={current.drop.rarity} size={128} />
        </span>
        <span className="flex gap-2">
          <span ref={xp} className="pk-chip" style={{ "--chip": "var(--band-lemon)" } as CSSProperties}>
            {xpWords(current.reward)}
          </span>
          <span ref={coins} className="pk-chip" style={{ "--chip": "var(--band-tangerine)" } as CSSProperties}>
            <CoinGlyph className="size-4" />
            {coinWords(current.reward)}
          </span>
        </span>
      </div>
    </div>
  );
}
