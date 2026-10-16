import { useState, type CSSProperties } from "react";
import { FoilPack } from "./FoilPack";
import type { Pack } from "./packs";

type PackStackProps = { packs: Pack[]; onPick: (at: number) => void };

const width = 120;

export function PackStack({ packs, onPick }: PackStackProps) {
  const [spread, setSpread] = useState(false);
  if (packs.length === 0) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No packs waiting. Buy one for 50 coins, or finish a quest.</p>;
  const middle = (packs.length - 1) / 2;
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="pk-stack w-full"
        data-spread={spread || undefined}
        style={{ "--pk-w": `${width}px` } as CSSProperties}
        onClick={() => {
          if (!spread) setSpread(true);
        }}
      >
        {packs.map((pack, at) => {
          const offset = at - middle;
          const style = spread ? { "--dx": `${offset * (width + 24)}px`, "--dy": "0px", "--r": "0deg", zIndex: at } : { "--dx": `${offset * 10}px`, "--dy": `${-at * 7}px`, "--r": `${offset * 3}deg`, zIndex: at };
          return (
            <div key={pack.n} className="pk-stack-item" style={style as CSSProperties}>
              <FoilPack pack={pack} width={width} still={!spread} label={spread ? `Open pack ${pack.n}` : `Fan out the ${packs.length} packs`} onTap={() => (spread ? onPick(at) : setSpread(true))} />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{spread ? "Pick a pack to open it." : `${packs.length} ${packs.length === 1 ? "pack" : "packs"} waiting · tap the stack to fan them out`}</p>
    </div>
  );
}
