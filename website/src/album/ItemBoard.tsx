import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { HypeEmoji } from "../../../convex/album/earnedEmojis";
import type { ReachedTier } from "../../../convex/album/milestones";
import type { ItemBoard as Board, BoardReason, LoopLesson } from "../../../convex/website/album";
import type { ShareReply } from "../shell";
import { LadderEmblem } from "../book/LadderEmblem";
import { NamedEmoji } from "../Emoji";
import type { Album } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { keepFocusIn } from "./focusTrap";
import { ShareWin } from "./ShareWin";
import { emblemOf, medalEmojiOf, medalKeyOf, medalWordsOf } from "./milestones";
import { nameOf, whatOf } from "./TurnFlight";
import type { Landing, ShownTurns } from "./useItemBoard";
import type { Flight } from "./useTurnFlight";
import "./itemBoard.css";

type ItemBoardProps = { board: Board; turning: boolean; trouble: string | null; flight: Flight | null; lead?: ReactNode; onTurn: (item: string, from: HTMLElement) => void; onLater: () => void };

export function ItemBoard({ board, turning, trouble, flight, lead, onTurn, onLater }: ItemBoardProps) {
  const dialog = useRef<HTMLElement>(null);
  const [touched, setTouched] = useState(false);
  const touch = () => setTouched(true);
  useFirstItemFocused(dialog, flight !== null);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    if (event.key !== "Escape") return;
    event.preventDefault();
    onLater();
  };
  return (
    <div className="ib-ground" data-stage={flight?.stage ?? "idle"} data-dark={flight?.dark ? "" : undefined}>
      <div className="ib-scrim" />
      <section ref={dialog} className="ib-board" role="dialog" aria-modal="true" aria-label="Your items" aria-busy={turning || undefined} onKeyDown={onKeyDown}>
        {lead}
        <h2 className="ib-title">{itemsWaitWordsOf(board)}</h2>
        <ul className="ib-items">
          {board.items.map(({ item, reason }, index) => (
            <li key={item} className="ib-slot" data-first={index === 0 ? "" : undefined} style={layOf(index)}>
              <button
                type="button"
                className="ib-item"
                data-active={flight?.item === item ? "" : undefined}
                aria-label={itemLabelOf(reason)}
                aria-disabled={turning || undefined}
                onPointerEnter={touch}
                onClick={(event) => {
                  touch();
                  onTurn(item, event.currentTarget);
                }}
              >
                <ItemBack />
                <LevelTag reason={reason} />
              </button>
              {index === 0 && !touched && <span className="ib-pointer" aria-hidden="true" />}
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

type ItemsWaitProps = { turns: ShownTurns; album: Album; shareItem: (item: string) => Promise<ShareReply> };

export function ItemsWait({ turns, album, shareItem }: ItemsWaitProps) {
  const { board, landing, offered, open, flight, closedByLater, show } = turns;
  const said = landing !== null && !open && flight === null;
  return (
    <div className="ib-strip">
      <p role="status" aria-label="Turned over" className="ib-turned">
        {said && <LandedWords landing={landing} />}
      </p>
      {said && landing.unlocked.milestones.length > 0 && <MedalsLine album={album} tiers={landing.unlocked.milestones} />}
      {said && landing.teaches && <LoopLine lesson={landing.teaches} />}
      {said && <ShareWin key={landing.item} item={landing.item} offered={album.shares} shareItem={shareItem} />}
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
      <span className="ph-no-capture">{`${nameOf(face)}: ${whatOf(face)}`}</span>
      {unlocked.teamStickers.map(({ team, name }) => (
        <span key={team}>{` · ${name} team sticker unlocked`}</span>
      ))}
      {applied !== null && <span className="ib-turned-xp">{`+${applied.xp} XP`}</span>}
    </>
  );
}

function MedalsLine({ album, tiers }: { album: Album; tiers: ReachedTier[] }) {
  return (
    <p role="note" aria-label="Medals unlocked" className="ib-medals">
      {tiers.map((tier) => (
        <MedalUnlocked key={medalKeyOf(tier)} album={album} tier={tier} />
      ))}
    </p>
  );
}

function MedalUnlocked({ album, tier }: { album: Album; tier: ReachedTier }) {
  const emoji = medalEmojiOf(album, tier);
  return (
    <span className="ib-medal">
      <LadderEmblem ladder={emblemOf(tier.milestone)} best={tier.tier} size={28} />
      {medalWordsOf(tier)}
      {emoji !== null && <img className="ph-no-capture" src={emoji.picture} alt={`:${emoji.name}:`} width={24} height={24} />}
      <NewLabel />
    </span>
  );
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

export function ItemBack() {
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

function useFirstItemFocused(dialog: RefObject<HTMLElement | null>, flying: boolean) {
  useEffect(() => {
    if (!flying) dialog.current?.querySelector<HTMLElement>(".ib-item")?.focus({ preventScroll: true });
  }, [dialog, flying]);
}

const tilts = [-7, 4, -2, 6, -5, 3, -4, 7, -3];

const nudges = [10, -18, 22, -6, 16, -20, 6, -14, 12];

const sizes = [1, 0.92, 1.04, 0.95, 1, 1.06, 0.9, 1, 0.94];

function layOf(index: number): CSSProperties {
  return { "--tilt": `${tilts[index % tilts.length]}deg`, "--nudge": `${nudges[index % nudges.length]}px`, "--size": sizes[index % sizes.length] } as CSSProperties;
}
