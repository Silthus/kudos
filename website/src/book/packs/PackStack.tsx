import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { crateTargetAttributes } from "../../linkTarget";
import { FoilPack } from "./FoilPack";
import { packsWaitingWordsOf, packsWordsOf, type WaitingPack } from "./packs";

type PackStackProps = { packs: WaitingPack[]; more: boolean; fanned: boolean; stackRef: RefObject<HTMLDivElement | null>; onFan: () => void; onPick: (crate: string) => void };

const width = 120;

const fanGap = 24;

export function PackStack({ packs, more, fanned, stackRef, onFan, onPick }: PackStackProps) {
  const step = useFanStep(stackRef, packs.length, fanned);
  const middle = (packs.length - 1) / 2;
  const waiting = packsWaitingWordsOf(packs.length);
  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={stackRef} role="group" aria-label={waiting} className="pk-stack w-full" data-spread={fanned || undefined} style={{ "--pk-w": `${width}px` } as CSSProperties}>
        {packs.map((pack, at) => (
          <div key={pack.crate} {...(pack.target !== undefined && crateTargetAttributes(pack.target))} className="pk-stack-item" style={layerStyle(at - middle, at, fanned, step)}>
            <FoilPack n={pack.n} state="sealed" drop={undefined} width={width} still={!fanned} label={fanned ? `Open pack ${pack.n}` : `Fan out the ${packsWordsOf(packs.length)}`} onTap={() => (fanned ? onPick(pack.crate) : onFan())} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {fanned ? "Pick a pack to open it." : `${waiting}${more ? " + more" : ""} · tap the stack to fan them out`}
      </p>
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
