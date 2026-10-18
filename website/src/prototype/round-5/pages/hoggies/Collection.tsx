// PROTOTYPE (#625, round 5): every hoggie as a large field guide plate, grouped by rarity, behind the All / Found / Still hidden / Spares filters. Never merge to main.
import { HoggieArt } from "../../../art";
import type { Album, Hoggie } from "../../../round-3/album";
import { ProgressBar } from "./HoggieDetail";
import { filterKeys, filters, hoggieLabel, isFound, keptBy, numberOf, rarityTint, rarityWords, shelfOf, shelvesOf, type Filter, type Rarity, type Shelf } from "./shelf";

type Choose = (hoggie: Hoggie) => void;

export function groupId(rarity: Rarity) {
  return `r5h-group-${rarity}`;
}

type Props = { album: Album; filter: Filter; onFilter: (filter: Filter) => void; landed: ReadonlySet<string>; onChoose: Choose };

export function Collection({ album, filter, onFilter, landed, onChoose }: Props) {
  const groups = shelvesOf(keptBy(filter, album.hoggies)).filter(({ hoggies }) => hoggies.length > 0);
  return (
    <section className="r5h-collection" aria-labelledby="r5h-collection-title">
      <div className="r5h-toolbar">
        <h2 id="r5h-collection-title" className="r5h-toolbar-title">
          The collection
        </h2>
        <FilterButtons album={album} filter={filter} onFilter={onFilter} />
      </div>
      {groups.length === 0 && <p className="r5h-nothing">{filters[filter].none}</p>}
      {groups.map((group) => (
        <Group key={group.rarity} group={group} album={album} landed={landed} onChoose={onChoose} />
      ))}
    </section>
  );
}

function FilterButtons({ album, filter, onFilter }: { album: Album; filter: Filter; onFilter: (filter: Filter) => void }) {
  return (
    <div className="r5h-filters" role="group" aria-label="Show">
      {filterKeys.map((key) => (
        <button key={key} type="button" className="r5h-filter" aria-pressed={key === filter} onClick={() => onFilter(key)}>
          {filters[key].words}
          <small>{keptBy(key, album.hoggies).length}</small>
        </button>
      ))}
    </div>
  );
}

function Group({ group, album, landed, onChoose }: { group: Shelf; album: Album; landed: ReadonlySet<string>; onChoose: Choose }) {
  const whole = shelfOf(group.rarity, album.hoggies);
  const titleId = `${groupId(group.rarity)}-title`;
  return (
    <section id={groupId(group.rarity)} className="r5h-group" style={rarityTint(group.rarity)} aria-labelledby={titleId}>
      <div className="r5h-group-head">
        <h3 id={titleId} className="r5h-group-title">
          {rarityWords[group.rarity]}
        </h3>
        <p className="r5h-group-about">
          {whole.found} of {whole.hoggies.length} found · {whole.shareOfRolls}% of rolls land here
        </p>
        <ProgressBar part={whole.found} whole={whole.hoggies.length} />
      </div>
      <ul className="r5h-plates">
        {group.hoggies.map((hoggie) => (
          <li key={hoggie.hoggie}>
            <Plate hoggie={hoggie} number={numberOf(hoggie, album.hoggies)} landed={landed.has(hoggie.hoggie)} onChoose={onChoose} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function plateClass(found: boolean, landed: boolean) {
  return ["r5h-plate", found ? "" : "r5h-plate-hidden", landed ? "r5h-plate-landed" : ""].filter(Boolean).join(" ");
}

function Plate({ hoggie, number, landed, onChoose }: { hoggie: Hoggie; number: string; landed: boolean; onChoose: Choose }) {
  const found = isFound(hoggie);
  return (
    <button type="button" className={plateClass(found, landed)} data-r5-hoggie={hoggie.hoggie} aria-label={landed ? `Just landed: ${hoggieLabel(hoggie)}` : hoggieLabel(hoggie)} onClick={() => onChoose(hoggie)}>
      {landed && <span className="r5h-plate-ribbon">Just landed</span>}
      <span className="r5h-plate-number">{number}</span>
      {hoggie.count > 1 && <span className="r5h-copies">×{hoggie.count}</span>}
      <span className="r5h-plate-art">
        <HoggieArt slug={hoggie.hoggie} size={88} silhouette={!found} />
      </span>
      <span className="r5h-plate-name">{found ? hoggie.name : "Not found yet"}</span>
      <span className="r5h-plate-rarity">{rarityWords[hoggie.rarity]}</span>
    </button>
  );
}
