import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { crateTargetAttributes } from "../../linkTarget";
import type { BoughtCrate } from "../../crates/readyCrates";
import { FoilPack } from "./FoilPack";
import { packsWaitingWordsOf, packsWordsOf } from "./packs";

type PackStackProps = { crates: BoughtCrate[]; fanned: boolean; stackRef: RefObject<HTMLDivElement | null>; onFan: () => void; onPick: (crate: BoughtCrate) => void };

const width = 120;

const fanGap = 24;

export function PackStack({ crates, fanned, stackRef, onFan, onPick }: PackStackProps) {
  const step = useFanStep(stackRef, crates.length, fanned);
  const middle = (crates.length - 1) / 2;
  const waiting = packsWaitingWordsOf(crates.length);
  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={stackRef} role="group" aria-label={waiting} className="pk-stack w-full" data-spread={fanned || undefined} style={{ "--pk-w": `${width}px` } as CSSProperties}>
        {crates.map((crate, at) => (
          <div key={crate.crate} {...crateTargetAttributes(crate.target)} className="pk-stack-item" style={layerStyle(at - middle, at, fanned, step)}>
            <FoilPack n={crate.target.n} state="sealed" drop={undefined} width={width} still={!fanned} label={fanned ? `Open pack ${crate.target.n}` : `Fan out the ${packsWordsOf(crates.length)}`} onTap={() => (fanned ? onPick(crate) : onFan())} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{fanned ? "Pick a pack to open it." : `${waiting} · tap the stack to fan them out`}</p>
    </div>
  );
}

function layerStyle(offset: number, at: number, fanned: boolean, step: number): CSSProperties {
  const fannedOut = { "--dx": `${offset * step}px`, "--dy": "0px", "--r": "0deg" };
  const stacked = { "--dx": `${offset * 10}px`, "--dy": `${-at * 7}px`, "--r": `${offset * 3}deg` };
  return { ...(fanned ? fannedOut : stacked), zIndex: at } as CSSProperties;
}

function useFanStep(stackRef: RefObject<HTMLDivElement | null>, count: number, fanned: boolean) {
  const [step, setStep] = useState(width + fanGap);
  useLayoutEffect(() => {
    if (!fanned || count < 2) return;
    const fit = () => setStep(Math.min(width + fanGap, Math.max(width / 3, ((stackRef.current?.clientWidth ?? 0) - width) / (count - 1))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [stackRef, count, fanned]);
  return step;
}
