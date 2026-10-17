// PROTOTYPE (#625): the Tome shelf under the inventory: collection progress per rarity and per team, each a bookmark into the Tome. Never merge to main.
import type { CSSProperties } from "react";
import { AppLink } from "../../AppLink";
import { CrestArt } from "../art";
import { rarityColour, type World } from "../world";
import { rarityLabel } from "./sheet";

export function Shelf({ world }: { world: World }) {
  return (
    <section className="v4-panel v4-shelf" aria-label="Tome of Hoggies">
      <header className="v4-plate">
        <span>Tome of Hoggies</span>
        <small>
          {world.owned} / {world.total} found
        </small>
        <AppLink href="/book" className="v4-plate-action">
          Open tome
        </AppLink>
      </header>
      <div className="v4-shelf-body">
        <ul className="v4-shelf-rarities">
          {world.rarities.map(({ rarity, owned, total }) => (
            <li key={rarity}>
              <AppLink href={`/book#hoggies/${rarity}`} className="v4-shelf-rarity" style={{ "--glow": rarityColour[rarity] } as CSSProperties}>
                <span style={{ color: rarityColour[rarity] }}>{rarityLabel[rarity]}</span>
                <span className="v4-shelf-bar">
                  <span style={{ width: `${(owned / Math.max(1, total)) * 100}%` }} />
                </span>
                <small>
                  {owned}/{total}
                </small>
              </AppLink>
            </li>
          ))}
        </ul>
        <ul className="v4-shelf-teams">
          {world.teams.map((team) => (
            <li key={team.team}>
              <AppLink href={`/book#teams/${team.team}`} className="v4-shelf-team" title={`${team.name}: ${team.held} of ${team.total}`}>
                <CrestArt art={team.art} size={30} name={team.name} collected={team.complete || team.crest !== null} />
                <span>{team.name}</span>
                <small>
                  {team.held}/{team.total}
                </small>
              </AppLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
