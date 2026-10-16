import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { IconArrowRight } from "@posthog/icons";
import { rarityWordsOf } from "../../crates/drops";
import { CoinGlyph } from "../../skills/glyphs";
import { FoilPack } from "./FoilPack";
import { coinWords, xpWords, type Pack } from "./packs";

type PackSessionProps = { packs: Pack[]; startAt: number; onFinish: (opened: Pack[]) => void };

const wordsOnly = (rarity: string) => rarityWordsOf(rarity as never).replace(/^\S+\s/, "");

export function PackSession({ packs, startAt, onFinish }: PackSessionProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<number[]>([]);
  const [tapped, setTapped] = useState<number[]>([startAt]);
  useEffect(() => dialog.current?.focus(), []);
  const openedPacks = opened.map((at) => packs[at]!);
  const allOpen = opened.length === packs.length;
  const finish = useCallback(() => onFinish(opened.map((at) => packs[at]!)), [onFinish, opened, packs]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  };
  const latest = openedPacks.at(-1);
  const legendary = latest?.drop.rarity === "legendary";
  return (
    <div ref={dialog} role="dialog" aria-label="Opening your crates" tabIndex={-1} data-rarity={latest?.drop.rarity ?? "common"} onKeyDown={onKeyDown} className="loot-scrim fixed inset-0 z-50 overflow-y-auto outline-none" style={{ "--loot-glow": latest ? `var(--rarity-${latest.drop.rarity})` : "var(--band-lemon)", "--pk-w": "200px" } as CSSProperties}>
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-5 pb-16 pt-[calc(var(--hud-height,3.5rem)+1.5rem)] text-center">
        <span className="hud-label" style={{ color: "rgb(255 255 255 / 0.7)" }}>
          {`Crates · ${opened.length} of ${packs.length} opened`}
        </span>
        <div className="pk-row w-full">
          {packs.map((pack, at) => {
            const isOpen = opened.includes(at);
            return (
              <div key={pack.n} className="pk-slot" data-pack={pack.n}>
                <FoilPack pack={pack} width={200} autoOpen={tapped.includes(at)} onTap={() => setTapped((before) => (before.includes(at) ? before : [...before, at]))} onOpened={() => setOpened((before) => (before.includes(at) ? before : [...before, at]))} />
                <div className="pk-chips">
                  {isOpen && (
                    <>
                      <span className="pk-chip" style={{ "--chip": "var(--band-lemon)", "--d": "0.05s" } as CSSProperties}>
                        {xpWords(pack.reward)}
                      </span>
                      <span className="pk-chip" style={{ "--chip": "var(--band-tangerine)", "--d": "0.2s" } as CSSProperties}>
                        <CoinGlyph className="size-4" />
                        {coinWords(pack.reward)}
                      </span>
                    </>
                  )}
                </div>
                {!isOpen && !tapped.includes(at) && <span className="loot-hint">Tap to open</span>}
              </div>
            );
          })}
        </div>
        {latest !== undefined && (
          <div key={latest.n} className="flex flex-col items-center gap-3">
            <span className="loot-ribbon loot-ribbon-in" data-rarity={latest.drop.rarity}>
              {legendary ? "✦ Legendary find ✦" : `${wordsOnly(latest.drop.rarity)} find`}
            </span>
            <h2 className="hud-display loot-in text-[clamp(2rem,7vw,3rem)] font-extrabold leading-tight" style={{ "--d": "0.15s" } as CSSProperties}>
              {latest.drop.name}
            </h2>
          </div>
        )}
        {allOpen ? (
          <button type="button" onClick={finish} className="loot-in inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--band-lemon)]" style={{ "--d": "0.5s" } as CSSProperties}>
            Put them in the book
            <IconArrowRight aria-hidden="true" className="size-4" />
          </button>
        ) : (
          <span className="text-xs" style={{ color: "rgb(255 255 255 / 0.5)" }}>
            {opened.length === 0 ? "Esc leaves the rest for later" : "Open the next one, or Esc to put these in the book"}
          </span>
        )}
      </div>
    </div>
  );
}
