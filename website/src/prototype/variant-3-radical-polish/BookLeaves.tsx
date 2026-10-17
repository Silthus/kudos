// PROTOTYPE (#625): what the book's pages hold: hoggie slots, team stickers, packs and achievement ladders. Never merge to main.
import type { CSSProperties } from "react";
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../collectionRead";
import type { LadderCard } from "../../shell";
import { CrestArt, HoggieArt, MemberFace } from "../art";
import { rarityColour, type Pack } from "../world";
import { LadderRow } from "./Lists";
import { FoilPack } from "./PackGlyph";
import { useStage } from "./stage";
import { packName, rarityName } from "./words";

export function HoggieSlots({ hoggies }: { hoggies: CollectionHoggie[] }) {
  return (
    <ul className="v3-slots v3-slots-hoggies">
      {hoggies.map((hoggie) => (
        <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} />
      ))}
    </ul>
  );
}

function HoggieSlot({ hoggie }: { hoggie: CollectionHoggie }) {
  const found = hoggie.count > 0;
  return (
    <li className="v3-slot" data-found={found || undefined} style={{ "--v3-rarity": rarityColour[hoggie.rarity] } as CSSProperties}>
      <span className="v3-slot-art">
        <HoggieArt slug={hoggie.hoggie} size={64} silhouette={!found} />
      </span>
      <span className="v3-slot-name">{found ? hoggie.name : "Not found yet"}</span>
      {hoggie.count > 1 && <span className="v3-slot-count v3-num">{`×${hoggie.count}`}</span>}
    </li>
  );
}

export function TeamHeader({ team }: { team: CollectionTeamPage }) {
  const leads = team.people.filter(({ lead }) => lead).map(({ name }) => name);
  return (
    <header className="v3-team-head">
      <CrestArt art={team.art} size={60} name={team.name} collected={team.crest !== null || team.complete} />
      <div>
        <h2 className="v3-h2">
          {team.name}
          {team.mine && <span className="v3-tag v3-tag-small">Your team</span>}
        </h2>
        <p className="v3-muted">{leads.length > 0 ? `Led by ${leads.join(" and ")}` : "No team lead listed"}</p>
      </div>
      <p className="v3-team-count">
        <strong className="v3-num">{`${team.held}/${team.total}`}</strong>
        <span className="v3-muted">{team.complete ? "Page complete" : "stickers"}</span>
      </p>
    </header>
  );
}

export function StickerSlots({ people }: { people: CollectionTeamPerson[] }) {
  return (
    <ul className="v3-slots v3-slots-people">
      {people.map((person, index) => (
        <li key={person.key} className="v3-sticker" data-held={person.held || undefined} style={{ "--v3-tilt": `${((index * 7) % 5) - 2}deg` } as CSSProperties}>
          <span className="v3-sticker-face">
            <MemberFace face={person.face} className="v3-sticker-img" />
          </span>
          <span className="v3-sticker-name">{person.held ? person.name : person.name.split(" ")[0]}</span>
          <span className="v3-sticker-role">{person.lead ? "Lead" : (person.role ?? "Teammate")}</span>
        </li>
      ))}
    </ul>
  );
}

export function PackSlots({ packs }: { packs: Pack[] }) {
  const { openPack } = useStage();
  if (packs.length === 0) return <p className="v3-empty">No packs waiting. Finish a quest or buy one on the left.</p>;
  return (
    <ul className="v3-slots v3-slots-packs">
      {packs.map((pack) => (
        <li key={pack.id} className="v3-pack-slot">
          <FoilPack width={92} label={packName[pack.kind]} />
          <span className="v3-muted v3-small v3-pack-from">{pack.from}</span>
          <button type="button" className="v3-button v3-button-primary v3-button-small" onClick={() => openPack(pack.id, packName[pack.kind])}>
            Open
          </button>
        </li>
      ))}
    </ul>
  );
}

export function LadderSlots({ ladders }: { ladders: LadderCard[] }) {
  return (
    <ul className="v3-plain-list v3-ladder-page">
      {ladders.map((ladder) => (
        <LadderRow key={ladder.ladder} ladder={ladder} />
      ))}
    </ul>
  );
}

export function RarityTitle({ rarity, owned, total }: { rarity: CollectionHoggie["rarity"]; owned: number; total: number }) {
  return (
    <header className="v3-leaf-title">
      <h2 className="v3-h2" style={{ color: `color-mix(in oklab, ${rarityColour[rarity]} 85%, #23251D)` }}>
        {rarityName[rarity]}
      </h2>
      <span className="v3-muted v3-num">{`${owned} of ${total} found`}</span>
    </header>
  );
}
