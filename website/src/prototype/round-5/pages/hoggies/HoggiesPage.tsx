// PROTOTYPE (#625, round 6): the hoggies page: B's header and rarest finds on top, then the collection under a sticky bar with the filters and the rarity strip, A's large plates and centred entry card. Never merge to main.
import { useEffect, useState } from "react";
import { useAlbum, type Album, type Hoggie } from "../../../round-3/album";
import { useChosenHoggie } from "./chosen";
import { Collection } from "./Collection";
import { Entry } from "./Entry";
import { useJustLanded } from "./landing";
import { Showcase } from "./Showcase";
import { foundIn, groupId, keptBy, shelfOf, type Filter, type Rarity } from "./shelf";
import "./hoggies.css";

export function HoggiesPage() {
  const { album } = useAlbum();
  const { chosen, choose, close } = useChosenHoggie(album.hoggies);
  const landed = useJustLanded();
  const [filter, setFilter] = useState<Filter>("all");
  const jump = useJump(filter, setFilter, album.hoggies);
  const shown = keptBy(filter, album.hoggies);
  return (
    <article className="r5h" aria-labelledby="r5h-title">
      <Header album={album} />
      <Showcase album={album} onChoose={choose} />
      <Collection album={album} filter={filter} onFilter={setFilter} onJump={jump} landed={landed} onChoose={choose} />
      {chosen !== null && <Entry hoggie={chosen} album={album} steps={shown.includes(chosen) ? shown : album.hoggies} onStep={choose} onClose={close} />}
    </article>
  );
}

function Header({ album }: { album: Album }) {
  const legendaries = shelfOf("legendary", album.hoggies).hoggies.length;
  return (
    <header className="r5h-head">
      <p className="r5h-eyebrow">Surprises</p>
      <h1 id="r5h-title" className="r5h-title">
        Hoggies
      </h1>
      <p className="r5h-lede">
        Every pack rolls one hoggie. You've found {foundIn(album.hoggies)} of {album.hoggies.length}, from the everyday commons to the {legendaries} legendaries.
      </p>
    </header>
  );
}

function useJump(filter: Filter, setFilter: (filter: Filter) => void, hoggies: Hoggie[]) {
  const [target, setTarget] = useState<Rarity | null>(null);
  useEffect(() => {
    if (target === null) return;
    document.getElementById(groupId(target))?.scrollIntoView({ block: "start" });
    setTarget(null);
  }, [target]);
  return (rarity: Rarity) => {
    if (!keptBy(filter, hoggies).some((hoggie) => hoggie.rarity === rarity)) setFilter("all");
    setTarget(rarity);
  };
}
