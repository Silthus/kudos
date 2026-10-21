import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import type { HypeEmoji } from "../../../convex/album/earnedEmojis";
import type { ItemBoard as Board, BoardReason, LoopLesson } from "../../../convex/website/album";
import { NamedEmoji } from "../Emoji";
import { EmojiPicture } from "./EmojiPicture";
import { keepFocusIn } from "./focusTrap";
import { rarityWordOf } from "./opening";
import type { ItemTurns, Landing } from "./useItemBoard";
import "./itemBoard.css";

type ItemBoardProps = { board: Board; turning: boolean; trouble: string | null; onTurn: (item: string) => void; onLater: () => void };

export function ItemBoard({ board, turning, trouble, onTurn, onLater }: ItemBoardProps) {
  const dialog = useRef<HTMLElement>(null);
  useFirstItemFocused(dialog);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    if (event.key !== "Escape") return;
    event.preventDefault();
    onLater();
  };
  return (
    <div className="ib-ground">
      <section ref={dialog} className="ib-board" role="dialog" aria-modal="true" aria-label="Your items" aria-busy={turning || undefined} onKeyDown={onKeyDown}>
        <h2 className="ib-title">{itemsWaitWordsOf(board)}</h2>
        <ul className="ib-items">
          {board.items.map(({ item, reason }, index) => (
            <li key={item} className="ib-slot" data-first={index === 0 ? "" : undefined} style={layOf(index)}>
              <button type="button" className="ib-item" aria-label={itemLabelOf(reason)} aria-disabled={turning || undefined} onClick={() => onTurn(item)}>
                <ItemBack />
                <LevelTag reason={reason} />
              </button>
            </li>
          ))}
        </ul>
        {trouble !== null && (
          <p role="alert" className="ib-trouble">
            {trouble}
          </p>
        )}
        <button type="button" className="ib-later" onClick={onLater}>
          Later
        </button>
      </section>
    </div>
  );
}

export function ItemsWait({ turns }: { turns: ItemTurns }) {
  const { board, landing, offered, open, closedByLater, show } = turns;
  return (
    <div className="ib-strip">
      <p role="status" aria-label="Turned over" className="ib-turned">
        {landing !== null && !open && <LandedWords landing={landing} />}
      </p>
      {landing?.teaches && !open && <LoopLine lesson={landing.teaches} />}
      {offered && board !== null && (
        <button type="button" className="ib-wait" autoFocus={closedByLater} onClick={show}>
          <span className="ib-wait-disc" aria-hidden="true">
            ?
          </span>
          {itemsWaitWordsOf(board)}
        </button>
      )}
    </div>
  );
}

function LandedWords({ landing: { face, applied, unlocked } }: { landing: Landing }) {
  return (
    <>
      <span className="ph-no-capture">{faceWordsOf(face)}</span>
      {unlocked.teamStickers.map(({ team, name }) => (
        <span key={team}>{` · ${name} team sticker unlocked`}</span>
      ))}
      {applied !== null && <span className="ib-turned-xp">{`+${applied.xp} XP`}</span>}
    </>
  );
}

function faceWordsOf(face: Landing["face"]) {
  const fresh = face.kind === "hoggie" ? face.drop.isNew : face.isNew;
  const said = face.kind === "hoggie" ? `${face.drop.name}: ${rarityWordOf(face.drop.rarity)} hoggie` : `${face.thanked.name ?? "Your teammate"}: Sticker`;
  return fresh ? `${said} · New` : said;
}

export function LandedHype({ hype, from }: { hype: HypeEmoji; from: string }) {
  return (
    <span role="img" aria-label={`:${hype.name}: hype emoji unlocked`} className="ib-landed-hype">
      <EmojiPicture emoji={{ kind: "hype", picture: hype.picture, from }} size={40} />
    </span>
  );
}

export function NewLabel() {
  return <span className="ib-new">New</span>;
}

function LoopLine({ lesson: { kudosEmoji, kudosEmojiImage } }: { lesson: LoopLesson }) {
  return (
    <p role="note" aria-label="How the next item comes" className="ib-loop">
      Your next item comes when you thank a teammate with <NamedEmoji name={kudosEmoji} image={kudosEmojiImage ?? undefined} /> and say why.
    </p>
  );
}

function ItemBack() {
  return (
    <span className="ib-back">
      <span className="ib-q">?</span>
    </span>
  );
}

function LevelTag({ reason }: { reason: BoardReason }) {
  if (reason.kind !== "levelUp") return null;
  return <span className="ib-level">Level {reason.level}</span>;
}

function itemLabelOf(reason: BoardReason) {
  return reason.kind === "levelUp" ? `A face-down item from level ${reason.level}. Turn it over` : "A face-down item. Turn it over";
}

function itemsWaitWordsOf({ items, more }: Board) {
  if (more) return `${items.length}+ items wait`;
  return items.length === 1 ? "1 item waits" : `${items.length} items wait`;
}

function useFirstItemFocused(dialog: RefObject<HTMLElement | null>) {
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>(".ib-item")?.focus({ preventScroll: true });
  }, [dialog]);
}

const tilts = [-7, 4, -2, 6, -5, 3, -4, 7, -3];

const nudges = [10, -18, 22, -6, 16, -20, 6, -14, 12];

const sizes = [1, 0.92, 1.04, 0.95, 1, 1.06, 0.9, 1, 0.94];

function layOf(index: number): CSSProperties {
  return { "--tilt": `${tilts[index % tilts.length]}deg`, "--nudge": `${nudges[index % nudges.length]}px`, "--size": sizes[index % sizes.length] } as CSSProperties;
}
