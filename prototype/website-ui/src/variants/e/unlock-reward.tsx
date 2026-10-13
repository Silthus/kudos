// Variant E reward crate: the same loot crate holding rewards instead of a feature; a click opens it and reveals the XP, coins, emoji or hedgehog inside.
import type { CSSProperties, ReactNode } from "react";
import { HedgehogParty } from "@posthog/brand/hoggies";
import { IconSparkles } from "@posthog/icons";
import { CoinGlyph } from "./hud";
import { CrateStage, useCrateOpening } from "./unlock-crate";

export type Rewards = { xp?: number; coins?: number; emoji?: string; hedgehog?: string };

type RewardCrateProps = { rewards: Rewards; onOpened?: () => void; name?: string; width?: number; dropIn?: boolean; autoFocus?: boolean };

export function RewardCrate({ rewards, onOpened, name = "Reward", width = 200, dropIn = false, autoFocus = false }: RewardCrateProps) {
  const { phase, open } = useCrateOpening({ dropIn, onOpened });
  const revealed = phase === "open";
  return (
    <div className="flex flex-col items-center gap-4">
      <CrateStage Hog={HedgehogParty} name={name} phase={phase} onOpen={open} width={width} autoFocus={autoFocus} />
      <div aria-live="polite" className="flex min-h-9 flex-wrap items-center justify-center gap-2">
        {revealed && <RewardChips rewards={rewards} />}
      </div>
    </div>
  );
}

function RewardChips({ rewards: { xp, coins, emoji, hedgehog } }: { rewards: Rewards }) {
  const chips: Array<[string, ReactNode, string]> = [];
  if (xp) chips.push(["xp", <IconSparkles key="g" className="size-4" />, `+${xp} XP`]);
  if (coins) chips.push(["coins", <CoinGlyph key="g" className="size-4" />, `+${coins} coins`]);
  if (emoji) chips.push(["emoji", <span key="g" className="text-lg leading-none">{emoji}</span>, "New emoji"]);
  if (hedgehog) chips.push(["hedgehog", <HedgehogParty key="g" size={20} title="" />, hedgehog]);
  return (
    <>
      {chips.map(([key, icon, text], i) => (
        <span key={key} className="uc-reveal inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold text-card-foreground shadow-sm" style={{ "--d": `${0.1 + i * 0.12}s` } as CSSProperties}>
          {icon}
          {text}
        </span>
      ))}
    </>
  );
}
