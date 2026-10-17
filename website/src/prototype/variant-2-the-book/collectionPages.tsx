// PROTOTYPE (#625): the book's collection pages: hoggie sheets by rarity and one spread per team. Never merge to main.
import type { CSSProperties } from "react";
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../collectionRead";
import type { Rarity } from "../../shell";
import { CrestArt, HoggieArt, MemberFace } from "../art";
import { rarityColour } from "../world";
import { useDesk } from "./desk";
import { rarityName } from "./text";

export function HoggieSheet({ rarity, sheet, sheets, hoggies }: { rarity: Rarity; sheet: number; sheets: number; hoggies: CollectionHoggie[] }) {
  const { world } = useDesk();
  const share = world.rarities.find((entry) => entry.rarity === rarity);
  return (
    <div className="v2-sheet" style={{ "--rarity": rarityColour[rarity] } as CSSProperties}>
      <header className="v2-sheet-head">
        <p className="v2-kicker">Hoggies</p>
        <h2 className="v2-rarity-title">
          {rarityName[rarity]}
          {sheets > 1 && <span className="v2-sheet-count"> · sheet {sheet} of {sheets}</span>}
        </h2>
        <p className="v2-caption">
          {share?.owned ?? 0} of {share?.total ?? 0} stuck in
        </p>
      </header>
      <ol className="v2-slots">
        {hoggies.map((hoggie) => (
          <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} />
        ))}
      </ol>
    </div>
  );
}

function HoggieSlot({ hoggie }: { hoggie: CollectionHoggie }) {
  const { stuck } = useDesk();
  const found = hoggie.count > 0;
  return (
    <li className="v2-slot" data-found={found} data-stuck={stuck === hoggie.hoggie} title={found ? hoggie.name : `${hoggie.name}: not found yet`}>
      <span className="v2-slot-art">
        <HoggieArt slug={hoggie.hoggie} size={56} silhouette={!found} />
      </span>
      <span className="v2-slot-name">{hoggie.name}</span>
      {hoggie.count > 1 && <span className="v2-slot-copies">×{hoggie.count}</span>}
    </li>
  );
}

export function TeamTitle({ team }: { team: CollectionTeamPage }) {
  const leads = team.people.filter(({ lead }) => lead).map(({ name }) => name);
  return (
    <div className="v2-team-title">
      <p className="v2-kicker">Team page{team.mine ? " · your team" : ""}</p>
      <div className="v2-crest-frame" data-complete={team.complete}>
        <CrestArt art={team.art} size={168} name={team.name} collected={team.complete || team.crest !== null} />
      </div>
      <h2 className="v2-team-name">{team.name}</h2>
      <p className="v2-caption">
        {team.held} of {team.total} teammates stuck in
      </p>
      <div className="v2-team-meter" role="meter" aria-valuemin={0} aria-valuemax={team.total} aria-valuenow={team.held} aria-label={`${team.name} page`}>
        <span style={{ width: `${team.total === 0 ? 0 : (team.held / team.total) * 100}%` }} />
      </div>
      {leads.length > 0 && <p className="v2-small">Led by {leads.join(" and ")}</p>}
      {team.complete ? <p className="v2-stamp">Page complete</p> : <p className="v2-small v2-hint">Thank a teammate in Slack to stick their sticker in.</p>}
    </div>
  );
}

export function TeamStickers({ team }: { team: CollectionTeamPage }) {
  const dense = team.people.length > 15;
  return (
    <div className="v2-team-stickers">
      <p className="v2-kicker">{team.name}</p>
      <ol className="v2-people" data-dense={dense}>
        {team.people.map((person) => (
          <PersonSticker key={person.key} person={person} />
        ))}
      </ol>
    </div>
  );
}

function PersonSticker({ person }: { person: CollectionTeamPerson }) {
  return (
    <li className="v2-person" data-held={person.held} title={person.held ? person.name : `Thank ${person.name} to collect`}>
      <span className="v2-person-face">{person.held ? <MemberFace face={person.face} className="v2-face" /> : <span className="v2-face v2-face-missing">?</span>}</span>
      <span className="v2-person-name">{person.name}</span>
      {person.role !== null && <span className="v2-person-role">{person.lead ? "Lead" : person.role}</span>}
    </li>
  );
}
