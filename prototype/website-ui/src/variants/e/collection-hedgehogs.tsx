// Variant E hedgehog shelf: every collectable hedgehog, equip the owned ones, buy store ones, see what unlocks the rest.
import { useState } from "react";
import { IconCheck, IconLock } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { Rarity } from "../../ui";
import { CoinGlyph, Panel, ResourceChip } from "./hud";
import { hedgehogs, sourceLabel, useHogs, type Hog } from "./hedgehogs";

const css = `
.collection-silhouette{filter:brightness(0);opacity:.18}
.dark .collection-silhouette{filter:brightness(0) invert(1);opacity:.14}
@media (prefers-reduced-motion:no-preference){
.collection-reveal{animation:collection-pop .55s cubic-bezier(.2,.8,.2,1.3)}
.collection-reveal .collection-art{animation:collection-art-in .6s cubic-bezier(.2,.8,.2,1.25) both}
}
@keyframes collection-pop{0%{transform:scale(.94)}55%{transform:scale(1.05)}100%{transform:scale(1)}}
@keyframes collection-art-in{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
`;

export function HedgehogShelf() {
  const hogs = useHogs();
  const [revealed, setRevealed] = useState<string>();
  const { coins } = hogs;
  const ownedCount = hedgehogs.filter((h) => hogs.isOwned(h.id)).length;

  const buy = (hog: Hog) => {
    hogs.buy(hog.id);
    setRevealed(hog.id);
  };

  return (
    <section className="hud-rise flex flex-col gap-4" aria-labelledby="hedgehogs-title">
      <style>{css}</style>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="hud-label">
            {ownedCount} of {hedgehogs.length} collected
          </div>
          <h2 id="hedgehogs-title" className="hud-display mt-1 text-4xl font-bold leading-none">
            Hedgehogs
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Your hedgehog is your avatar on your profile card and the leaderboard, and it never changes what a kudos is worth.</p>
        </div>
        <ResourceChip icon={<CoinGlyph />} title="Your coins">
          {coins.toLocaleString()} coins
        </ResourceChip>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hedgehogs.map((hog) => (
          <li key={hog.id} className="flex">
            <HogCard hog={hog} owned={hogs.isOwned(hog.id)} equipped={hogs.equipped.id === hog.id} coins={coins} revealed={revealed === hog.id} onEquip={() => hogs.equip(hog.id)} onBuy={() => buy(hog)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HogCard({ hog, owned, equipped, coins, revealed, onEquip, onBuy }: { hog: Hog; owned: boolean; equipped: boolean; coins: number; revealed: boolean; onEquip: () => void; onBuy: () => void }) {
  const locked = !owned && hog.source.kind !== "store";
  return (
    <Panel className={`hud-lift w-full ${equipped ? "ring-2 ring-primary" : ""} ${revealed ? "collection-reveal" : ""}`} bodyClassName="flex h-full flex-col gap-2">
      <div className={`flex h-24 items-center justify-center rounded-md ${locked ? "bg-muted/60" : "bg-muted"}`}>
        <span className={`collection-art inline-flex ${locked ? "collection-silhouette" : ""}`}>
          <hog.Art size={84} title={locked ? `${hog.name}, still locked` : hog.name} />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={`truncate font-semibold ${locked ? "text-muted-foreground" : ""}`}>{hog.name}</span>
        <Rarity rarity={hog.rarity} />
        <span className="flex items-start gap-1 text-xs text-muted-foreground">
          {locked && <IconLock className="mt-px size-3.5 shrink-0" />}
          {sourceLabel(hog.source)}
        </span>
      </div>
      <div className="mt-auto pt-1">
        <HogAction hog={hog} owned={owned} equipped={equipped} coins={coins} onEquip={onEquip} onBuy={onBuy} />
      </div>
    </Panel>
  );
}

function HogAction({ hog, owned, equipped, coins, onEquip, onBuy }: { hog: Hog; owned: boolean; equipped: boolean; coins: number; onEquip: () => void; onBuy: () => void }) {
  if (equipped)
    return (
      <Button size="sm" variant="secondary" disabled className="w-full">
        <IconCheck /> Equipped
      </Button>
    );
  if (owned)
    return (
      <Button size="sm" variant="outline" className="w-full" onClick={onEquip}>
        Equip
      </Button>
    );
  if (hog.source.kind !== "store") return null;
  const { price } = hog.source;
  const short = price - coins;
  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant={short > 0 ? "outline" : "primary"} disabled={short > 0} className="w-full" onClick={onBuy}>
        Buy for {price.toLocaleString()} coins
      </Button>
      {short > 0 && <span className="text-center text-[11px] text-muted-foreground">{short.toLocaleString()} more coins to go</span>}
    </div>
  );
}
