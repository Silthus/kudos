// PROTOTYPE (#625): the shelf of unopened packs, with the kiosk price tag that leads to the store.
import { useRef } from "react";
import type { Pack, PackKind, World } from "../world";

export const packLook: Record<PackKind, { label: string; className: string }> = {
  journey: { label: "Journey", className: "v5-pack-journey" },
  weekly: { label: "Weekly", className: "v5-pack-weekly" },
  group: { label: "Team", className: "v5-pack-group" },
  bought: { label: "Kiosk", className: "v5-pack-bought" },
};

const packsShown = 5;

export function Shelf({ world, onOpen, onKiosk }: { world: World; onOpen: (pack: Pack) => void; onKiosk: () => void }) {
  const firstSeen = useRef(new Set(world.packs.map(({ id }) => id)));
  return (
    <section className="v5-shelf" aria-label="Pack shelf">
      <p className="v5-shelf-title">{world.packs.length === 0 ? "No packs waiting" : `${world.packs.length} pack${world.packs.length === 1 ? "" : "s"} to open`}</p>
      <div className="v5-shelf-packs">
        {world.packs.slice(0, packsShown).map((pack, index) => (
          <PackOnShelf key={pack.id} pack={pack} index={index} fresh={!firstSeen.current.has(pack.id)} onOpen={onOpen} />
        ))}
        {world.packs.length > packsShown && <span className="v5-shelf-more">+{world.packs.length - packsShown}</span>}
      </div>
      <div className="v5-shelf-plank" />
      <button type="button" className="v5-kiosk-tag" onClick={onKiosk}>
        <span className="v5-kiosk-tag-hole" />
        Kiosk
        <strong>Pack · {world.store.price} coins</strong>
      </button>
    </section>
  );
}

function PackOnShelf({ pack, index, fresh, onOpen }: { pack: Pack; index: number; fresh: boolean; onOpen: (pack: Pack) => void }) {
  const look = packLook[pack.kind];
  return (
    <button type="button" className={`v5-pack ${look.className} ${fresh ? "v5-pack-fresh" : ""}`} style={{ zIndex: index + 1 }} onClick={() => onOpen(pack)} title={`From: ${pack.from}`} aria-label={`Open the ${look.label} pack from ${pack.from}`}>
      <PackFace kind={pack.kind} />
    </button>
  );
}

export function PackFace({ kind }: { kind: PackKind }) {
  return (
    <>
      <span className="v5-pack-crimp v5-pack-crimp-top" />
      <span className="v5-pack-brand">HedgeHug</span>
      <span className="v5-pack-kind">{packLook[kind].label}</span>
      <span className="v5-pack-mark">?</span>
      <span className="v5-pack-crimp v5-pack-crimp-bottom" />
    </>
  );
}
