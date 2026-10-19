import type { CSSProperties } from "react";
import { hoggieNamed } from "../../../convex/hoggies/catalogue";
import { hoggiePictureOf } from "../crates/Hoggie";
import { MemberFace } from "../Face";
import { HedgehogSitting } from "../hoggies";
import type { Album, TrayItem } from "./answer";
import { rarityWordOf } from "./opening";
import { destinationOf, type Destination } from "./tray";
import "./tray.css";

type TrayPanelProps = { album: Album; trouble: string | null; onPutIn: (item: string) => void; onPutAllIn: () => void };

export function TrayPanel({ album, trouble, onPutIn, onPutAllIn }: TrayPanelProps) {
  const { tray } = album;
  return (
    <div className="al-tray-panel">
      {trouble !== null && (
        <p role="alert" className="al-tray-trouble">
          {trouble}
        </p>
      )}
      {tray.length === 0 ? (
        <p>Open a pack and what it holds waits here to be put in.</p>
      ) : (
        <>
          <h2 className="al-tray-title">Opened, not in your album yet</h2>
          <p className="al-tray-hint">Each card flies to its place. Put them in one by one, or all at once.</p>
          <ul className="al-tray-rows">
            {tray.map((item) => (
              <TrayRow key={item.item} album={album} item={item} onPutIn={() => onPutIn(item.item)} />
            ))}
          </ul>
          <button type="button" className="al-tray-all" onClick={onPutAllIn}>
            {tray.length === 1 ? "Put it in" : `Put them all in · ${tray.length}`}
          </button>
        </>
      )}
    </div>
  );
}

function TrayRow({ album, item, onPutIn }: { album: Album; item: TrayItem; onPutIn: () => void }) {
  return (
    <li className="al-tray-row">
      <TrayToken item={item} />
      <span className="al-tray-where">
        <ItemName item={item} />
        <span className="al-tray-goes" data-completes={completesThePage(album, item) ? "" : undefined}>
          {goesWords(destinationOf(album, item), item)}
        </span>
      </span>
      <button type="button" className={item.kind === "sticker" ? "al-tray-put ph-no-capture" : "al-tray-put"} onClick={onPutIn} aria-label={putInLabelOf(item)}>
        Put in
      </button>
    </li>
  );
}

export function TrayToken({ item }: { item: TrayItem }) {
  if (item.kind === "sticker") {
    const { face } = item.thanked;
    return <span className="al-tray-token al-tray-token-person ph-no-capture">{face === null ? <span className="al-tray-token-blank" /> : <MemberFace face={face} className="al-tray-face" />}</span>;
  }
  const picture = hoggiePictureOf({ kind: "hoggie", slug: item.hoggie });
  return (
    <span className="al-tray-token al-tray-token-hoggie" style={{ "--token-rarity": `var(--rarity-${item.rarity})` } as CSSProperties}>
      {picture === undefined ? <HedgehogSitting size={28} /> : <img src={picture} alt="" draggable={false} />}
    </span>
  );
}

function ItemName({ item }: { item: TrayItem }) {
  if (item.kind === "hoggie") return <strong>{hoggieNameOf(item.hoggie)}</strong>;
  const { name } = item.thanked;
  return <strong className={name === null ? undefined : "ph-no-capture"}>{name ?? "A teammate"}</strong>;
}

function goesWords(destination: Destination, item: TrayItem) {
  switch (destination.kind) {
    case "hoggies":
      return item.kind === "hoggie" ? `→ Hoggies · ${rarityWordOf(item.rarity)}, ${item.isNew ? "new" : "a spare"}` : "→ Hoggies";
    case "team":
      return `→ ${destination.team.name} · ${destination.completes ? "completes the page!" : `${destination.team.held}/${destination.team.total} → ${destination.after}/${destination.team.total}`}`;
    case "held":
      return "· already in your album";
    case "album":
      return "→ your album";
  }
}

function completesThePage(album: Album, item: TrayItem) {
  const destination = destinationOf(album, item);
  return destination.kind === "team" && destination.completes;
}

function putInLabelOf(item: TrayItem) {
  if (item.kind === "hoggie") return `Put ${hoggieNameOf(item.hoggie)} in`;
  const { name } = item.thanked;
  return name === null ? "Put your teammate's card in" : `Put ${name}'s card in`;
}

export function hoggieNameOf(hoggie: string) {
  return hoggieNamed(hoggie)?.name ?? hoggie;
}
