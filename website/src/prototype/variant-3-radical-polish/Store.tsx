// PROTOTYPE (#625): the store counter: packs waiting, open the next, buy one for coins. Never merge to main.
import { useWorld, type Pack, type World } from "../world";
import { Coin } from "./motion";
import { PackGlyph } from "./PackGlyph";
import { useStage } from "./stage";
import { packName } from "./words";

export function StoreCounter({ world, compact = false }: { world: World; compact?: boolean }) {
  const { actions } = useWorld();
  const { openPack } = useStage();
  const next = world.packs[0];
  const price = world.store.price;
  return (
    <div className="v3-store" data-compact={compact || undefined}>
      <div className="v3-store-stack">
        <span className="v3-store-packs" aria-hidden="true">
          {world.packs.slice(0, 3).map((pack) => (
            <PackGlyph key={pack.id} size={compact ? 30 : 40} />
          ))}
        </span>
        <span>
          <strong className="v3-num">{world.packs.length}</strong> {world.packs.length === 1 ? "pack waiting" : "packs waiting"}
        </span>
      </div>
      <div className="v3-store-actions">
        {next !== undefined && <OpenButton pack={next} onOpen={openPack} />}
        <button type="button" className="v3-button" disabled={world.coins < price} onClick={() => actions.buyPack()}>
          Buy a pack
          <span className="v3-price">
            <Coin size={14} />
            {price}
          </span>
        </button>
      </div>
      {world.coins < price && <p className="v3-muted v3-small">{`You need ${price - world.coins} more coins.`}</p>}
    </div>
  );
}

function OpenButton({ pack, onOpen }: { pack: Pack; onOpen: (id: string, name: string) => void }) {
  return (
    <button type="button" className="v3-button v3-button-primary" onClick={() => onOpen(pack.id, packName[pack.kind])}>
      <PackGlyph size={18} />
      Open next
    </button>
  );
}
