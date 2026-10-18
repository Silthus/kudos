// PROTOTYPE (#625, round 3): person stickers, hoggie stickers and their printed empty slots. Never merge to main.
import type { CSSProperties } from "react";
import type { Hoggie, Person } from "../album";
import { HoggieArt, MemberFace } from "../../art";
import { firstNameOf, rarityWords, shinyRarities, tiltOf } from "./model";

type StickerLook = { width: number; colour: string; captain?: boolean };

export function PersonSticker({ person, number, look, teamName }: { person: Pick<Person, "key" | "name" | "face" | "role">; number: number | null; look: StickerLook; teamName: string }) {
  return (
    <span className={`sa-sticker ${look.captain ? "sa-sticker-captain" : ""}`} style={{ "--w": `${look.width}px`, "--team": look.colour } as CSSProperties}>
      <span className="sa-sticker-band" />
      {number !== null && <span className="sa-sticker-number">{number}</span>}
      {look.captain && <span className="sa-sticker-captain-badge">Captain</span>}
      <span className="sa-sticker-face">
        <MemberFace face={person.face} className="sa-face" />
      </span>
      <span className="sa-sticker-name">{person.name}</span>
      {look.width >= 110 && <span className="sa-sticker-role">{person.role ?? teamName}</span>}
      <span className="sa-sticker-gloss" />
    </span>
  );
}

export function PersonSlot({ person, number, look, teamName, landing, onOpen }: { person: Person; number: number; look: StickerLook; teamName: string; landing: boolean; onOpen: () => void }) {
  const held = person.collectedAt !== null;
  const style = { "--w": `${look.width}px`, "--tilt": `${tiltOf(person.key)}deg` } as CSSProperties;
  return (
    <button type="button" onClick={onOpen} className={`sa-slot ${held ? "sa-slot-held" : "sa-slot-empty"} ${look.captain ? "sa-slot-captain" : ""} ${landing ? "sa-landing" : ""}`} style={style} aria-label={held ? `${person.name}, sticker ${number}. Open their card.` : `Sticker ${number}, ${person.name}, not collected yet.`}>
      {held ? (
        <PersonSticker person={person} number={number} look={look} teamName={teamName} />
      ) : (
        <span className="sa-slot-print">
          <span className="sa-slot-print-number">{number}</span>
          {look.captain && <span className="sa-slot-print-captain">Captain</span>}
          <span className="sa-slot-print-name">{look.width >= 90 ? person.name : firstNameOf(person.name)}</span>
        </span>
      )}
    </button>
  );
}

export function HoggieSticker({ hoggie, width, number }: { hoggie: Pick<Hoggie, "hoggie" | "name" | "rarity">; width: number; number: string | null }) {
  return (
    <span className={`sa-hoggie ${shinyRarities.has(hoggie.rarity) ? "sa-hoggie-shiny" : ""}`} style={{ "--w": `${width}px`, "--rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
      <span className="sa-hoggie-foil" />
      {number !== null && <span className="sa-hoggie-number">{number}</span>}
      <span className="sa-hoggie-art">
        <HoggieArt slug={hoggie.hoggie} size={Math.round(width * 0.78)} />
      </span>
      {width >= 100 && <span className="sa-hoggie-name">{hoggie.name}</span>}
      {shinyRarities.has(hoggie.rarity) && <span className="sa-glint" />}
    </span>
  );
}

export function HoggieSlot({ hoggie, width, number, landing }: { hoggie: Hoggie; width: number; number: string; landing: boolean }) {
  const found = hoggie.count > 0;
  const style = { "--w": `${width}px`, "--tilt": `${tiltOf(hoggie.hoggie) / 2}deg` } as CSSProperties;
  return (
    <span className={`sa-hslot ${found ? "sa-hslot-found" : "sa-hslot-empty"} ${landing ? "sa-landing" : ""}`} style={style} title={found ? `${hoggie.name} · ${rarityWords[hoggie.rarity]}${hoggie.count > 1 ? ` · ×${hoggie.count}` : ""}` : `${number} · not found yet`}>
      {found ? (
        <>
          <HoggieSticker hoggie={hoggie} width={width} number={number} />
          {hoggie.count > 1 && <span className="sa-hslot-count">×{hoggie.count}</span>}
        </>
      ) : (
        <span className="sa-hslot-print">
          <span className="sa-hslot-silhouette">
            <HoggieArt slug={hoggie.hoggie} size={Math.round(width * 0.62)} silhouette />
          </span>
          <span className="sa-hslot-number">{number}</span>
        </span>
      )}
    </span>
  );
}

export function StickerBack({ size = 1 }: { size?: number }) {
  return (
    <span className="sa-card-back" style={{ "--s": size } as CSSProperties}>
      <span className="sa-card-back-ring">
        <span className="sa-card-back-mark">HedgeHug</span>
      </span>
    </span>
  );
}
